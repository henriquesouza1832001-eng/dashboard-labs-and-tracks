from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from databricks import sql
import os, json, asyncio, hashlib, jwt, datetime, threading, time

# ─── Auth ────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")

def verificar_admin(request: Request):
    try:
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "admin":
            return None
        return payload
    except:
        return None

app = FastAPI()

# ─── Databricks connection ────────────────────────────────────────────────────
HOST         = os.getenv("DATABRICKS_HOST", "")
TOKEN        = os.getenv("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "d523a4cf58739a90")

_conn_cache = None
_conn_lock  = threading.Lock()

def get_conn():
    global _conn_cache
    with _conn_lock:
        try:
            if _conn_cache and _conn_cache.open:
                return _conn_cache
        except:
            pass
        _conn_cache = sql.connect(
            server_hostname = HOST,
            http_path       = f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
            access_token    = TOKEN,
        )
        return _conn_cache

# ─── Cache em RAM — thread-safe ───────────────────────────────────────────────
_cache      = {}
_cache_lock = threading.Lock()

# Schemas
S_CHAMADOS   = "eng_lab.dashboard_labs_and_tracks_chamados"
S_OBRAS      = "eng_lab.dashboard_labs_and_tracks_obras"
S_CODIN      = "eng_lab.dashboard_labs_and_tracks_codin"
S_CONFORTO   = "eng_lab.dashboard_labs_and_tracks_conforto"
S_ATIVIDADES = "eng_lab.dashboard_labs_and_tracks_atividades"
S_HUB        = "eng_lab.dashboard_labs_and_tracks_hub"

# Todos os módulos que devem ser pre-aquecidos
MODULOS = [
    (S_CHAMADOS,   "chamados_completo",   "chamados_principal"),
    (S_OBRAS,      "obras_completo",      "obras_principal"),
    (S_CODIN,      "codin_completo",      "codin_principal"),
    (S_CONFORTO,   "conforto_completo",   "conforto_principal"),
    (S_ATIVIDADES, "atividades_completo", "atividades_principal"),
]

def _warm(schema, table, chave):
    """Busca do Databricks e salva no cache. Seguro para threads."""
    key = f"{table}/{chave}"
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT dados_json FROM {schema}.{table} WHERE chave = ? LIMIT 1",
                [chave]
            )
            row = cur.fetchone()
            if row:
                dados = json.loads(row[0])
                with _cache_lock:
                    _cache[key] = dados
                return dados
    except Exception as e:
        print(f"[warm] erro [{key}]: {e}")
    return None

def _background_refresh(intervalo=300):
    """Daemon: refresca todos os módulos a cada `intervalo` segundos (padrão 5 min)."""
    while True:
        time.sleep(intervalo)
        print("[cache] iniciando refresh em background...")
        threads = [
            threading.Thread(target=_warm, args=(s, t, c), daemon=True)
            for s, t, c in MODULOS
        ]
        for th in threads:
            th.start()
        for th in threads:
            th.join()
        print("[cache] refresh concluído.")

def db_get(schema, table, chave):
    """Lê do cache RAM. Só vai ao Databricks se não estiver em cache (cold start)."""
    key = f"{table}/{chave}"
    with _cache_lock:
        if key in _cache:
            return _cache[key]
    # Cache miss — busca síncrona (só no cold start ou após falha)
    return _warm(schema, table, chave)

def db_save(schema, table, chave, dados, usuario="sistema"):
    """Persiste no Databricks e atualiza o cache RAM imediatamente."""
    key = f"{table}/{chave}"
    try:
        j = json.dumps(dados, ensure_ascii=False)
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(f"""
                MERGE INTO {schema}.{table} AS t
                USING (SELECT ? AS chave, ? AS dados_json, ? AS atualizado_por) AS s
                ON t.chave = s.chave
                WHEN MATCHED THEN UPDATE SET
                    dados_json     = s.dados_json,
                    atualizado_por = s.atualizado_por,
                    atualizado_em  = current_timestamp()
                WHEN NOT MATCHED THEN INSERT (chave, dados_json, atualizado_por, atualizado_em)
                    VALUES (s.chave, s.dados_json, s.atualizado_por, current_timestamp())
            """, [chave, j, usuario])
        with _cache_lock:
            _cache[key] = dados
        return True
    except Exception as e:
        print(f"[db_save] erro: {e}")
        return False

def get_usuario(request):
    return request.headers.get("X-Forwarded-User", "dev@local")

# ─── Startup: aquece tudo em paralelo + lança daemon de refresh ──────────────
@app.on_event("startup")
async def prefetch():
    loop = asyncio.get_event_loop()
    print("[startup] aquecendo cache em paralelo...")
    futures = [
        loop.run_in_executor(None, _warm, s, t, c)
        for s, t, c in MODULOS
    ]
    await asyncio.gather(*futures)
    print("[startup] cache aquecido. Lançando refresh daemon (5 min).")
    threading.Thread(target=_background_refresh, args=(300,), daemon=True).start()

# ─── Health ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    with _cache_lock:
        keys = list(_cache.keys())
    return {"status": "ok", "cache_keys": keys}

# ─── API: Chamados ────────────────────────────────────────────────────────────
@app.get("/api/chamados")
async def get_chamados():
    dados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal")
    return JSONResponse(dados if dados else {"chamados": []})

@app.post("/api/chamados")
async def save_chamados(request: Request):
    dados = await request.json()
    ok = db_save(S_CHAMADOS, "chamados_completo", "chamados_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.put("/api/chamados/{cid}")
async def update_chamado(cid: str, request: Request):
    dados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal") or {"chamados": []}
    lista = dados.get("chamados", [])
    body  = await request.json()
    idx   = next((i for i, c in enumerate(lista) if str(c.get("id")) == str(cid)), None)
    if idx is None:
        return JSONResponse({"ok": False, "erro": "não encontrado"}, status_code=404)
    lista[idx]       = body
    dados["chamados"] = lista
    ok = db_save(S_CHAMADOS, "chamados_completo", "chamados_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.delete("/api/chamados/{cid}")
async def delete_chamado(cid: str, request: Request):
    dados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal") or {"chamados": []}
    lista = dados.get("chamados", [])
    dados["chamados"] = [c for c in lista if str(c.get("id")) != str(cid)]
    ok = db_save(S_CHAMADOS, "chamados_completo", "chamados_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/chamados/sla")
async def get_sla():
    cfg = db_get(S_HUB, "config", "sla_global") or {"Crítica": 1, "Alta": 3, "Média": 5, "Baixa": 7}
    return JSONResponse(cfg)

@app.post("/api/chamados/sla")
async def save_sla(request: Request):
    cfg = await request.json()
    ok  = db_save(S_HUB, "config", "sla_global", cfg, get_usuario(request))
    return JSONResponse({"ok": ok})

# ─── API: Obras ───────────────────────────────────────────────────────────────
@app.get("/api/obras")
async def get_obras():
    dados = db_get(S_OBRAS, "obras_completo", "obras_principal")
    return JSONResponse(dados if dados else {"obras": [], "lancamentos": [], "budget": [], "revisoes": []})

@app.post("/api/obras")
async def save_obras(request: Request):
    dados = await request.json()
    ok = db_save(S_OBRAS, "obras_completo", "obras_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

# ─── API: CODIN ───────────────────────────────────────────────────────────────
@app.get("/api/codin")
async def get_codin():
    dados = db_get(S_CODIN, "codin_completo", "codin_principal")
    return JSONResponse(dados if dados else {"pessoas": [], "pontos": [], "acessos": [], "leitores": []})

@app.post("/api/codin")
async def save_codin(request: Request):
    dados = await request.json()
    ok = db_save(S_CODIN, "codin_completo", "codin_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

# ─── API: Conforto ────────────────────────────────────────────────────────────
@app.get("/api/conforto")
async def get_conforto():
    dados = db_get(S_CONFORTO, "conforto_completo", "conforto_principal")
    return JSONResponse(dados if dados else {"areas": [], "ucs": [], "ordens": []})

@app.post("/api/conforto")
async def save_conforto(request: Request):
    dados = await request.json()
    ok = db_save(S_CONFORTO, "conforto_completo", "conforto_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

# ─── API: Atividades ──────────────────────────────────────────────────────────
@app.get("/api/atividades")
async def get_atividades():
    dados = db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal")
    return JSONResponse(dados if dados else {"atividades": []})

@app.post("/api/atividades")
async def save_atividades(request: Request):
    dados = await request.json()
    ok = db_save(S_ATIVIDADES, "atividades_completo", "atividades_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

# ─── API: Hub ─────────────────────────────────────────────────────────────────
@app.get("/api/hub/config")
async def get_hub_config(request: Request):
    usuario = get_usuario(request)
    dados   = db_get(S_HUB, "config", f"config_{usuario}")
    return JSONResponse(dados if dados else {})

@app.post("/api/hub/config")
async def save_hub_config(request: Request):
    dados   = await request.json()
    usuario = get_usuario(request)
    try:
        j    = json.dumps(dados, ensure_ascii=False)
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(f"""
                MERGE INTO {S_HUB}.config AS t
                USING (SELECT ? AS usuario, ? AS config_json) AS s
                ON t.usuario = s.usuario
                WHEN MATCHED THEN UPDATE SET
                    config_json   = s.config_json,
                    atualizado_em = current_timestamp()
                WHEN NOT MATCHED THEN INSERT (usuario, config_json, atualizado_em)
                    VALUES (s.usuario, s.config_json, current_timestamp())
            """, [usuario, j])
        return JSONResponse({"ok": True})
    except Exception as e:
        print(f"[hub config] erro: {e}")
        return JSONResponse({"ok": False})

@app.get("/api/hub/dados")
async def get_hub_dados():
    chamados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal") or {"chamados": []}
    obras    = db_get(S_OBRAS,    "obras_completo",    "obras_principal")    or {"obras": [], "lancamentos": []}
    c = chamados.get("chamados", [])
    o = obras.get("obras", [])
    l = obras.get("lancamentos", [])
    return JSONResponse({
        "chamados": {
            "total":      len(c),
            "abertos":    len([x for x in c if x.get("status") == "Aberto"]),
            "andamento":  len([x for x in c if x.get("status") == "Em Andamento"]),
            "concluidos": len([x for x in c if x.get("status") == "Concluído"]),
            "criticos":   len([x for x in c if x.get("prioridade") == "Crítica" and x.get("status") not in ["Concluído", "Cancelado"]]),
        },
        "obras": {
            "total":       len(o),
            "andamento":   len([x for x in o if x.get("status") == "Em Andamento"]),
            "concluidas":  len([x for x in o if x.get("status") == "Concluído"]),
            "gasto_total": sum(x.get("precoUnit", 0) * x.get("qtd", 1) for x in l),
        }
    })

# ─── API: KPI (agrega tudo — servido do cache, instantâneo) ──────────────────
@app.get("/api/kpi/dados")
async def get_kpi():
    return JSONResponse({
        "chamados":   db_get(S_CHAMADOS,   "chamados_completo",   "chamados_principal")   or {},
        "obras":      db_get(S_OBRAS,      "obras_completo",      "obras_principal")      or {},
        "atividades": db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal") or {},
        "conforto":   db_get(S_CONFORTO,   "conforto_completo",   "conforto_principal")   or {},
    })

# ─── API: Auth ────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(request: Request):
    try:
        body  = await request.json()
        email = body.get("email", "").strip().lower()
        senha = body.get("senha", "")
        if not email or not senha:
            return JSONResponse({"erro": "credenciais inválidas"}, status_code=401)
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT nome, email, senha_hash, role, ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios WHERE email = ? LIMIT 1",
                [email]
            )
            row = cur.fetchone()
        if not row:
            return JSONResponse({"erro": "credenciais inválidas"}, status_code=401)
        nome, db_email, senha_hash, role, ativo = row
        if not ativo:
            return JSONResponse({"erro": "usuário inativo"}, status_code=403)
        if hashlib.sha256(senha.encode()).hexdigest() != senha_hash:
            return JSONResponse({"erro": "credenciais inválidas"}, status_code=401)
        payload = {
            "nome":  nome,
            "email": db_email,
            "role":  role,
            "exp":   datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        return JSONResponse({"token": token})
    except Exception as e:
        print(f"[login] erro: {e}")
        return JSONResponse({"erro": "erro interno"}, status_code=500)

# ─── API: Admin ───────────────────────────────────────────────────────────────
@app.get("/api/admin/usuarios")
async def admin_listar(request: Request):
    token_data = verificar_admin(request)
    if not token_data:
        return JSONResponse({"erro": "sem permissão"}, status_code=403)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id, nome, email, role, ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios ORDER BY id")
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    return JSONResponse(rows)

@app.post("/api/admin/usuarios")
async def admin_criar(request: Request):
    token_data = verificar_admin(request)
    if not token_data:
        return JSONResponse({"erro": "sem permissão"}, status_code=403)
    body       = await request.json()
    senha_hash = hashlib.sha256(body["senha"].encode()).hexdigest()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO eng_lab.`dashboard-labs-and-tracks`.usuarios (nome, email, senha_hash, role, ativo) VALUES (?,?,?,?,true)",
            [body["nome"], body["email"].lower(), senha_hash, body.get("role", "visualizador")]
        )
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}")
async def admin_toggle(uid: int, request: Request):
    token_data = verificar_admin(request)
    if not token_data:
        return JSONResponse({"erro": "sem permissão"}, status_code=403)
    body = await request.json()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET ativo=? WHERE id=?",
            [body["ativo"], uid]
        )
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}/senha")
async def admin_reset_senha(uid: int, request: Request):
    token_data = verificar_admin(request)
    if not token_data:
        return JSONResponse({"erro": "sem permissão"}, status_code=403)
    body      = await request.json()
    nova_hash = hashlib.sha256(body["senha"].encode()).hexdigest()
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET senha_hash=? WHERE id=?",
            [nova_hash, uid]
        )
    return JSONResponse({"ok": True})

# ─── Páginas HTML ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse("ERPFiat-Portatil/resources/hub/hub.html")

@app.get("/hub")
async def hub():
    return FileResponse("ERPFiat-Portatil/resources/hub/hub.html")

@app.get("/chamados")
async def chamados_page():
    return FileResponse("ERPFiat-Portatil/resources/chamados/chamados.html")

@app.get("/obras")
async def obras_page():
    return FileResponse("ERPFiat-Portatil/resources/obras/obras.html")

@app.get("/codin")
async def codin_page():
    return FileResponse("ERPFiat-Portatil/resources/codins/codin.html")

@app.get("/conforto")
async def conforto_page():
    return FileResponse("ERPFiat-Portatil/resources/conforto/conforto.html")

@app.get("/atividades")
async def atividades_page():
    return FileResponse("ERPFiat-Portatil/resources/atividades/atividades.html")

@app.get("/kpi")
async def kpi_page():
    return FileResponse("ERPFiat-Portatil/resources/kpi/kpi.html")

@app.get("/admin")
async def admin_page():
    return FileResponse("ERPFiat-Portatil/resources/admin/admin.html")

@app.get("/login")
async def login_page():
    return FileResponse("ERPFiat-Portatil/resources/login/login.html")

# ─── PWA ─────────────────────────────────────────────────────────────────────
@app.get("/app.webmanifest")
async def webmanifest():
    return FileResponse(
        "ERPFiat-Portatil/resources/manifest.json",
        media_type="application/manifest+json"
    )

@app.get("/sw.js")
async def service_worker():
    return FileResponse(
        "ERPFiat-Portatil/resources/sw.js",
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"}
    )

@app.get("/manifest.json")
async def manifest():
    return FileResponse(
        "ERPFiat-Portatil/resources/manifest.json",
        media_type="application/manifest+json"
    )

# ─── Static fallback (deve ser o último mount) ────────────────────────────────
app.mount("/", StaticFiles(directory="ERPFiat-Portatil/resources", html=True), name="static")