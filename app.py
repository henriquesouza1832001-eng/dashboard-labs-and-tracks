from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from databricks import sql
import os, json, asyncio, hashlib, jwt, datetime, threading, time
def to_date_or_none(v):
    if not v or not str(v).strip():
        return None
    return v

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ───────────────────────────────────────────────────────────────────
JWT_SECRET   = os.getenv("JWT_SECRET")
HOST         = os.getenv("DATABRICKS_HOST", "")
TOKEN        = os.getenv("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "d523a4cf58739a90")
BASE         = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ERPFiat-Portatil/resources")

# ─── Schemas ──────────────────────────────────────────────────────────────────
S_CHAMADOS   = "eng_lab.dashboard_labs_and_tracks_chamados"
S_OBRAS      = "eng_lab.dashboard_labs_and_tracks_obras"
S_CODIN      = "eng_lab.dashboard_labs_and_tracks_codin"
S_CONFORTO   = "eng_lab.dashboard_labs_and_tracks_conforto"
S_ATIVIDADES = "eng_lab.dashboard_labs_and_tracks_atividades"
S_HUB        = "eng_lab.dashboard_labs_and_tracks_hub"

# ─── Conexão Databricks (thread-safe, reconecta automaticamente) ───────────────
_conn_lock = threading.Lock()
_local = threading.local()

def get_conn():
    conn = getattr(_local, "conn", None)
    for _ in range(2):
        try:
            if conn:
                with conn.cursor() as _c:
                    _c.execute("SELECT 1")
                _local.conn = conn
                return conn
        except:
            conn = None
            _local.conn = None
        try:
            conn = sql.connect(
                server_hostname=HOST,
                http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
                access_token=TOKEN,
                _socket_timeout=30,
            )
            _local.conn = conn
        except:
            pass
    return conn

# ─── Helpers SQL síncronos (uso interno e em threads) ─────────────────────────
def run_query(sql_str, params=None):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql_str, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

def run_exec(sql_str, params=None):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql_str, params or [])

# ─── Wrappers async (SEMPRE usar estes dentro de endpoints async) ──────────────
async def arun_query(sql_str, params=None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_query, sql_str, params)

async def arun_exec(sql_str, params=None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_exec, sql_str, params)

# ─── Cache RAM ─────────────────────────────────────────────────────────────────
_cache      = {}
_cache_lock = threading.Lock()

def cache_get(key):
    with _cache_lock:
        return _cache.get(key)

def cache_set(key, value):
    with _cache_lock:
        _cache[key] = value

def cache_invalidate(*keys):
    with _cache_lock:
        for k in keys:
            _cache.pop(k, None)

def _ts(v):
    if v and hasattr(v, "isoformat"):
        return v.isoformat()
    return v

def get_usuario(request: Request):
    return request.headers.get("X-Forwarded-User", "dev@local")

def verificar_admin(request: Request):
    token = request.headers.get("X-Ctrl-Token", "")
    print(f"[admin] token recebido: {'sim' if token else 'NAO'} (len={len(token)})")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            print(f"[admin] payload decodificado: {payload}")
            if payload.get("role") == "admin":
                return payload
            else:
                print(f"[admin] role no token nao e admin: '{payload.get('role')}'")
        except Exception as e:
            print(f"[admin] erro ao decodificar token: {e}")
    email = request.headers.get("X-Forwarded-User", "").strip().lower()
    print(f"[admin] email do header: '{email}'")
    if not email:
        return None
    try:
        rows = run_query(
            "SELECT role FROM eng_lab.`dashboard-labs-and-tracks`.usuarios WHERE email=? AND ativo=true LIMIT 1",
            [email]
        )
        print(f"[admin] resultado da query por header: {rows}")
        if rows and rows[0].get("role") == "admin":
            return {"email": email, "role": "admin"}
    except Exception as e:
        print(f"[admin] erro na query: {e}")
    return None

def inject(html_path, dados):
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    script = f'<script>window.__DADOS__={json.dumps(dados, ensure_ascii=False, default=str)};</script>'
    if "</head>" in html:
        return HTMLResponse(html.replace("</head>", f"{script}\n</head>"),
                             headers={"Cache-Control": "no-store"})
    return HTMLResponse(html.replace("</body>", f"{script}\n</body>"),
                         headers={"Cache-Control": "no-store"})

# ─── Loaders (síncronos — rodam em thread pool no startup e no refresh) ────────
def _load_chamados():
    rows = run_query(f"SELECT * FROM {S_CHAMADOS}.chamados ORDER BY dataAbertura DESC")
    ids = [r["id"] for r in rows]
    fotos_map = {}
    historico_map = {}
    if ids:
        fotos = run_query(f"SELECT chamado_id, url FROM {S_CHAMADOS}.fotos")
        for f in fotos:
            fotos_map.setdefault(f["chamado_id"], []).append(f["url"])
        historico = run_query(f"SELECT chamado_id, usuario, acao, data FROM {S_CHAMADOS}.historico ORDER BY data")
        for h in historico:
            historico_map.setdefault(h["chamado_id"], []).append(h)
    for r in rows:
        r["fotos"]     = fotos_map.get(r["id"], [])
        r["historico"] = historico_map.get(r["id"], [])
        for f in ("dataAbertura", "dataConclusao", "atualizado_em"):
            r[f] = _ts(r.get(f))
    payload = {"chamados": rows}
    cache_set("chamados", payload)
    return payload

def _load_obras():
    obras = run_query(f"SELECT * FROM {S_OBRAS}.obras")
    etapas_todas = run_query(f"SELECT * FROM {S_OBRAS}.etapas")
    etapas_map = {}
    for e in etapas_todas:
        etapas_map.setdefault(e["obra_cod"], []).append(e)
    for o in obras:
        o["etapas"]        = etapas_map.get(o["cod"], [])
        o["atualizado_em"] = _ts(o.get("atualizado_em"))
    budget = run_query(f"SELECT * FROM {S_OBRAS}.budget")
    for b in budget:
        b["atualizado_em"] = _ts(b.get("atualizado_em"))
    lancs = run_query(f"SELECT * FROM {S_OBRAS}.lancamentos ORDER BY dtLanc DESC")
    for l in lancs:
        l["atualizado_em"] = _ts(l.get("atualizado_em"))
    payload = {"versao": "2.0", "obras": obras, "budget": budget, "lancamentos": lancs, "revisoes": []}
    cache_set("obras", payload)
    return payload

def _load_codin():
    pessoas = run_query(f"SELECT * FROM {S_CODIN}.pessoas")
    pontos  = run_query(f"SELECT * FROM {S_CODIN}.pontos")
    leitores_todos = run_query(f"SELECT ponto_id, leitor_id FROM {S_CODIN}.ponto_leitores")
    leitores_map = {}
    for l in leitores_todos:
        leitores_map.setdefault(l["ponto_id"], []).append(l["leitor_id"])
    for p in pontos:
        p["nome_ponto"] = p.get("nome")
        p["leitores"] = leitores_map.get(p["id"], [])
    for x in pessoas + pontos:
        x["atualizado_em"] = _ts(x.get("atualizado_em"))
    payload = {"pessoas": pessoas, "pontos": pontos, "acessos": [], "leitores": []}
    cache_set("codin", payload)
    return payload

def _load_atividades():
    rows = run_query(f"""
        SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (
                PARTITION BY id ORDER BY atualizado_em DESC NULLS LAST
            ) AS _rn
            FROM {S_ATIVIDADES}.atividades
        ) WHERE _rn = 1
        ORDER BY criadoEm DESC
    """)
    for r in rows:
        r.pop("_rn", None)
    comentarios_todos = run_query(f"SELECT atividade_id, autor, texto, data FROM {S_ATIVIDADES}.comentarios ORDER BY data")
    comentarios_map = {}
    for c in comentarios_todos:
        c["data"] = _ts(c.get("data")) or ""
        comentarios_map.setdefault(c["atividade_id"], []).append(c)
    for r in rows:
        r["comentarios"]   = comentarios_map.get(r["id"], [])
        r["atualizado_em"] = _ts(r.get("atualizado_em"))
    payload = {"versao": "2.0", "atividades": rows}
    cache_set("atividades", payload)
    return payload

def _load_conforto():
    def safe_json(v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return []
        return v or []

    try:
        rows = run_query(f"SELECT * FROM {S_CONFORTO}.config LIMIT 1")
        config = rows[0] if rows else {}
        if "checklist_preventiva" in config:
            config["checklistPreventiva"] = safe_json(config.pop("checklist_preventiva"))
        config = json.loads(json.dumps(config, default=str))
    except Exception as e:
        print(f"[conforto] erro ao carregar config: {e}")
        config = {}

    def load_table(tabela, mapper):
        try:
            return [mapper(r) for r in run_query(f"SELECT * FROM {S_CONFORTO}.{tabela}")]
        except Exception as e:
            print(f"[conforto] erro ao carregar {tabela}: {e}")
            return []

    ucs = load_table("ucs", lambda u: {
        "id":              u.get("id"),
        "codigo":          u.get("codigo"),
        "nome":            u.get("nome"),
        "local":           u.get("local"),
        "modelo":          u.get("modelo"),
        "categoria":       u.get("categoria") or "Ar-Condicionado",
        "tipo":            u.get("tipo"),
        "capacidadeBtu":   u.get("capacidade_btu"),
        "dataInstalacao":  str(u.get("data_instalacao") or ""),
        "cicloFiltroDias": u.get("ciclo_filtro_dias"),
        "responsavelId":   u.get("responsavel_id"),
        "obs":             u.get("obs") or "",
    })

    preventivas = load_table("preventivas", lambda p: {
        "id":            p.get("id"),
        "ucId":          p.get("uc_id"),
        "tecnicoId":     p.get("tecnico_id"),
        "dataPrevista":  str(p.get("data_prevista") or ""),
        "dataRealizada": str(p.get("data_realizada") or ""),
        "status":        p.get("status"),
        "checklist":     safe_json(p.get("checklist")),
        "obs":           p.get("obs") or "",
        "origem":        p.get("origem") or "manual",
        "inicioEm":      _ts(p.get("inicio_em")) or "",
        "fimEm":         _ts(p.get("fim_em")) or "",
        "duracaoMin":    p.get("duracao_min"),
        "numPessoas":    p.get("num_pessoas"),
        "tecnicos":      safe_json(p.get("tecnicos")) or [],
        "fotoUrl":       p.get("foto_url") or "",
    })

    ordens = load_table("ordens", lambda o: {
        "id":            o.get("id"),
        "tipo":          o.get("tipo"),
        "areaId":        o.get("area_id"),
        "responsavelId": o.get("responsavel_id"),
        "dataPrevista":  str(o.get("data_prevista") or ""),
        "dataRealizada": str(o.get("data_realizada") or ""),
        "status":        o.get("status"),
        "horaInicio":    o.get("hora_inicio") or "08:00",
        "horaFim":       o.get("hora_fim") or "09:00",
        "obs":           o.get("obs") or "",
        "origemRotina":  o.get("origem_rotina") or "",
    })

    manutencoes = load_table("manutencoes", lambda m: {
        "id":             m.get("id"),
        "ucId":           m.get("uc_id"),
        "tecnicoId":      m.get("tecnico_id"),
        "tipo":           m.get("tipo") or "Manutenção",
        "falha":          m.get("falha") or "",
        "dataAbertura":   str(m.get("data_abertura") or ""),
        "dataFechamento": str(m.get("data_fechamento") or ""),
        "status":         m.get("status"),
        "custoEstimado":  m.get("custo_estimado", 0),
        "pecasUtilizadas":m.get("pecas_utilizadas") or "",
        "obs":            m.get("obs") or "",
        "origem":         m.get("origem") or "manual",
        "inicioEm":       _ts(m.get("inicio_em")) or "",
        "fimEm":          _ts(m.get("fim_em")) or "",
        "duracaoMin":     m.get("duracao_min"),
        "numPessoas":     m.get("num_pessoas"),
        "tecnicos":       safe_json(m.get("tecnicos")) or [],
        "fotoUrl":        m.get("foto_url") or "",
        "pausas":         safe_json(m.get("pausas")) or [],
    })

    pecas = load_table("pecas", lambda p: {
        "id":         p.get("id"),
        "codigo":     p.get("codigo"),
        "descricao":  p.get("descricao") or "",
        "categoria":  p.get("categoria") or "",
        "fabricante": p.get("fabricante") or "",
        "referencia": p.get("referencia") or "",
        "unidade":    p.get("unidade") or "",
        "estqAtual":  p.get("estq_atual") or 0,
        "estqMinimo": p.get("estq_minimo") or 0,
    })

    requisicoes = load_table("requisicoes", lambda r: {
        "id":             r.get("id"),
        "pecaId":         r.get("peca_id"),
        "quantidade":     r.get("quantidade") or 0,
        "destino":        r.get("destino") or "",
        "solicitanteId":  r.get("solicitante_id"),
        "dataNecessidade":str(r.get("data_necessidade") or ""),
        "status":         r.get("status"),
    })

    areas = load_table("areas", lambda a: {
        "id":            a.get("id"),
        "nome":          a.get("nome"),
        "local":         a.get("local") or "",
        "tipo":          a.get("tipo") or "",
        "metragem":      a.get("metragem") or 0,
        "freqCivil":     a.get("freq_civil") or "",
        "freqTecnica":   a.get("freq_tecnica") or "",
        "responsavelId": a.get("responsavel_id"),
        "obs":           a.get("obs") or "",
    })

    fornecedores = load_table("fornecedores", lambda f: {
        "id":          f.get("id"),
        "nome":        f.get("nome"),
        "cnpj":        f.get("cnpj") or "",
        "tipoServico": f.get("tipo_servico") or "",
        "contato":     f.get("contato") or "",
        "telefone":    f.get("telefone") or "",
        "email":       f.get("email") or "",
        "ativo":       f.get("ativo") or "Sim",
    })

    tecnicos = load_table("tecnicos", lambda t: {
        "id":           t.get("id"),
        "nome":         t.get("nome"),
        "matricula":    t.get("matricula") or "",
        "especialidade":t.get("especialidade") or "",
        "turno":        t.get("turno") or "",
    })

    rotinas = load_table("rotinas", lambda r: {
        "id":            r.get("id"),
        "nome":          r.get("nome"),
        "tipo":          r.get("tipo"),
        "areaId":        r.get("area_id"),
        "responsavelId": r.get("responsavel_id"),
        "frequencia":    r.get("frequencia"),
        "diasSemana":    safe_json(r.get("dias_semana")),
        "horaInicio":    r.get("hora_inicio") or "08:00",
        "horaFim":       r.get("hora_fim") or "09:00",
        "ativa":         bool(r.get("ativa", True)),
    })

    payload = {
        "modulo": "conforto", "versao": "2.0",
        "ordens": ordens, "ucs": ucs, "preventivas": preventivas,
        "manutencoes": manutencoes, "pecas": pecas, "requisicoes": requisicoes,
        "areas": areas, "fornecedores": fornecedores, "tecnicos": tecnicos,
        "rotinas": rotinas, "config": config,
    }
    cache_set("conforto", payload)
    return payload

LOADERS = {
    "chamados":   _load_chamados,
    "obras":      _load_obras,
    "codin":      _load_codin,
    "atividades": _load_atividades,
    "conforto":   _load_conforto,
}

def get_cached(modulo):
    v = cache_get(modulo)
    if v is not None:
        return v
    return LOADERS[modulo]()

# ─── Startup: aquece cache + inicia refresh em background ─────────────────────
def _background_refresh(intervalo=300):
    while True:
        time.sleep(intervalo)
        print("[cache] refresh iniciado...")
        for nome, fn in LOADERS.items():
            try:
                fn()
            except Exception as e:
                print(f"[cache] erro ao refrescar {nome}: {e}")
        print("[cache] refresh concluido.")

@app.on_event("startup")
async def prefetch():
    loop = asyncio.get_event_loop()
    print("[startup] aquecendo cache...")
    for nome, fn in LOADERS.items():
        try:
            print(f"[startup] carregando {nome}...")
            await loop.run_in_executor(None, fn)
            print(f"[startup] {nome} ok")
        except Exception as e:
            print(f"[startup] {nome} erro: {e}")
    print("[startup] cache aquecido.")
    threading.Thread(target=_background_refresh, args=(300,), daemon=True).start()

# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    with _cache_lock:
        keys = list(_cache.keys())
    return {"status": "ok", "cache": keys}

@app.get("/api/admin/refresh-cache")
async def refresh_cache():
    loop = asyncio.get_event_loop()
    for nome, fn in LOADERS.items():
        try:
            await loop.run_in_executor(None, fn)
        except Exception as e:
            print(f"[cache] erro ao refrescar {nome}: {e}")
    return {"ok": True, "recarregados": list(LOADERS.keys())}

@app.get("/api/admin/debug-conforto")
async def debug_conforto():
    dados = get_cached("conforto")
    return JSONResponse({
        "ucs_count": len(dados.get("ucs", [])),
        "ucs": dados.get("ucs", []),
        "checklist": dados.get("config", {}).get("checklistPreventiva", []),
    })

# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(request: Request):
    try:
        body  = await request.json()
        email = body.get("email", "").strip().lower()
        senha = body.get("senha", "")
        if not email or not senha:
            return JSONResponse({"erro": "credenciais invalidas"}, status_code=401)
        rows = await arun_query(
            "SELECT nome,email,senha_hash,role,ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios WHERE email=? LIMIT 1",
            [email]
        )
        if not rows:
            return JSONResponse({"erro": "credenciais invalidas"}, status_code=401)
        r = rows[0]
        if not r["ativo"]:
            return JSONResponse({"erro": "usuario inativo"}, status_code=403)
        if hashlib.sha256(senha.encode()).hexdigest() != r["senha_hash"]:
            return JSONResponse({"erro": "credenciais invalidas"}, status_code=401)
        token = jwt.encode({
            "nome": r["nome"], "email": r["email"], "role": r["role"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        }, JWT_SECRET, algorithm="HS256")
        return JSONResponse({"token": token})
    except Exception as e:
        print(f"[login] erro: {e}")
        return JSONResponse({"erro": "erro interno"}, status_code=500)

# ─── Admin ────────────────────────────────────────────────────────────────────
@app.get("/api/admin/usuarios")
async def admin_listar(request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro": "sem permissao"}, status_code=403)
    rows = await arun_query(
        "SELECT id,nome,email,role,ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios ORDER BY id"
    )
    return JSONResponse(rows)

@app.post("/api/admin/usuarios")
async def admin_criar(request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro": "sem permissao"}, status_code=403)
    body = await request.json()
    await arun_exec(
        "INSERT INTO eng_lab.`dashboard-labs-and-tracks`.usuarios (nome,email,senha_hash,role,ativo) VALUES (?,?,?,?,true)",
        [body["nome"], body["email"].lower(), hashlib.sha256(body["senha"].encode()).hexdigest(), body.get("role", "visualizador")]
    )
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}")
async def admin_toggle(uid: int, request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro": "sem permissao"}, status_code=403)
    body = await request.json()
    await arun_exec(
        "UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET ativo=? WHERE id=?",
        [body["ativo"], uid]
    )
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}/senha")
async def admin_reset_senha(uid: int, request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro": "sem permissao"}, status_code=403)
    body = await request.json()
    await arun_exec(
        "UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET senha_hash=? WHERE id=?",
        [hashlib.sha256(body["senha"].encode()).hexdigest(), uid]
    )
    return JSONResponse({"ok": True})

# ─── Chamados ─────────────────────────────────────────────────────────────────
@app.get("/api/chamados")
async def get_chamados():
    return JSONResponse(get_cached("chamados"))

@app.post("/api/chamados")
async def create_chamado(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        await arun_exec(f"""
            INSERT INTO {S_CHAMADOS}.chamados
                (id,titulo,categoria,tipo,prioridade,local,setor,solicitante,
                 dataDesejada,descricao,status,responsavel,idExterno,
                 dataAbertura,dataConclusao,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            body["id"], body.get("titulo"), body.get("categoria"), body.get("tipo"),
            body.get("prioridade"), body.get("local"), body.get("setor"),
            body.get("solicitante"), body.get("dataDesejada"), body.get("descricao"),
            body.get("status", "Aberto"), body.get("responsavel"), body.get("idExterno"),
            body.get("dataAbertura"), body.get("dataConclusao"), u
        ])
        for foto in body.get("fotos", []):
            await arun_exec(f"INSERT INTO {S_CHAMADOS}.fotos (chamado_id, url) VALUES (?,?)", [body["id"], foto])
        for h in body.get("historico", []):
            await arun_exec(f"INSERT INTO {S_CHAMADOS}.historico (chamado_id, usuario, acao) VALUES (?,?,?)", [body["id"], h.get("usuario"), h.get("acao")])
    except Exception as e:
        print(f"[chamados] erro ao criar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("chamados")
    return JSONResponse({"ok": True})

@app.put("/api/chamados/{cid}")
async def update_chamado(cid: str, request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        await arun_exec(f"""
            UPDATE {S_CHAMADOS}.chamados SET
                status=?, responsavel=?, idExterno=?, prioridade=?,
                tipo=?, dataDesejada=?, dataConclusao=?,
                atualizado_por=?
            WHERE id=?
        """, [
            body.get("status"), body.get("responsavel"), body.get("idExterno"),
            body.get("prioridade"), body.get("tipo"), body.get("dataDesejada"),
            body.get("dataConclusao"), u, cid
        ])
        await arun_exec(f"DELETE FROM {S_CHAMADOS}.fotos WHERE chamado_id=?", [cid])
        for foto in body.get("fotos", []):
            await arun_exec(f"INSERT INTO {S_CHAMADOS}.fotos (chamado_id, url) VALUES (?,?)", [cid, foto])
        await arun_exec(f"DELETE FROM {S_CHAMADOS}.historico WHERE chamado_id=?", [cid])
        for h in body.get("historico", []):
            await arun_exec(f"INSERT INTO {S_CHAMADOS}.historico (chamado_id, usuario, acao) VALUES (?,?,?)",
                [cid, h.get("usuario"), h.get("acao")])
    except Exception as e:
        print(f"[chamados] erro ao atualizar {cid}: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("chamados")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_chamados)
    return JSONResponse({"ok": True})

@app.delete("/api/chamados/{cid}")
async def delete_chamado(cid: str):
    try:
        await arun_exec(f"DELETE FROM {S_CHAMADOS}.chamados WHERE id = ?", [cid])
    except Exception as e:
        print(f"[chamados] erro ao excluir {cid}: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("chamados")
    return JSONResponse({"ok": True})

@app.get("/api/chamados/por-email/{email}")
async def chamados_por_email(email: str):
    todos = get_cached("chamados").get("chamados", [])
    email = email.strip().lower()
    filtrados = [c for c in todos if (c.get("solicitante") or "").strip().lower() == email]
    return JSONResponse({"chamados": filtrados})

@app.get("/meus-chamados")
async def meus_chamados_page():
    return FileResponse(f"{BASE}/meuschamados/meuschamados.html")

@app.get("/api/chamados/areas-qr")
async def get_areas_qr():
    rows = await arun_query(f"SELECT * FROM {S_CHAMADOS}.areas_qr")
    return JSONResponse(rows)

@app.post("/api/chamados/areas-qr")
async def add_area_qr(request: Request):
    body = await request.json()
    await arun_exec(f"INSERT INTO {S_CHAMADOS}.areas_qr (id, nome, slug) VALUES (?,?,?)",
        [body["id"], body["nome"], body["slug"]])
    return JSONResponse({"ok": True})

@app.delete("/api/chamados/areas-qr/{aid}")
async def delete_area_qr(aid: str):
    await arun_exec(f"DELETE FROM {S_CHAMADOS}.areas_qr WHERE id=?", [aid])
    return JSONResponse({"ok": True})

@app.get("/api/chamados/sla")
async def get_sla():
    v = cache_get("sla")
    if v:
        return JSONResponse(v)
    try:
        rows = await arun_query(f"SELECT prioridade, dias FROM {S_HUB}.sla")
        if rows:
            cfg = {r["prioridade"]: r["dias"] for r in rows}
            cache_set("sla", cfg)
            return JSONResponse(cfg)
    except:
        pass
    return JSONResponse({"Critica": 1, "Alta": 3, "Media": 5, "Baixa": 7})

@app.post("/api/chamados/sla")
async def save_sla(request: Request):
    cfg = await request.json()
    u = get_usuario(request)
    try:
        for prioridade, dias in cfg.items():
            await arun_exec(f"""
                MERGE INTO {S_HUB}.sla AS t
                USING (SELECT ? AS prioridade) AS s ON t.prioridade = s.prioridade
                WHEN MATCHED THEN UPDATE SET dias=?
                WHEN NOT MATCHED THEN INSERT (prioridade, dias) VALUES (?,?)
            """, [prioridade, dias, prioridade, dias])
    except Exception as e:
        print(f"[sla] erro ao salvar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_set("sla", cfg)
    return JSONResponse({"ok": True})

# ─── Obras ────────────────────────────────────────────────────────────────────
@app.get("/api/obras")
async def get_obras():
    return JSONResponse(get_cached("obras"))

@app.post("/api/obras")
async def save_obras(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        async def salvar_obra(o):
            await arun_exec(f"""
                MERGE INTO {S_OBRAS}.obras AS t
                USING (SELECT ? AS cod) AS s ON t.cod = s.cod
                WHEN MATCHED THEN UPDATE SET
                    nome=?,tipo=?,local=?,responsavel=?,respNome=?,cresp=?,status=?,
                    dtInicioPrev=?,dtFimPrev=?,dtInicioReal=?,dtFimReal=?,obs=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT
                    (cod,nome,tipo,local,responsavel,respNome,cresp,status,
                     dtInicioPrev,dtFimPrev,dtInicioReal,dtFimReal,obs,atualizado_por)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, [
                o["cod"], o.get("nome"), o.get("tipo"), o.get("local"), o.get("responsavel"),
                o.get("respNome"), o.get("cresp"), o.get("status"), o.get("dtInicioPrev"),
                o.get("dtFimPrev"), o.get("dtInicioReal"), o.get("dtFimReal"), o.get("obs"), u,
                o["cod"], o.get("nome"), o.get("tipo"), o.get("local"), o.get("responsavel"),
                o.get("respNome"), o.get("cresp"), o.get("status"), o.get("dtInicioPrev"),
                o.get("dtFimPrev"), o.get("dtInicioReal"), o.get("dtFimReal"), o.get("obs"), u
            ])
            await arun_exec(f"DELETE FROM {S_OBRAS}.etapas WHERE obra_cod=?", [o["cod"]])
            for e in o.get("etapas", []):
                await arun_exec(f"""
                    INSERT INTO {S_OBRAS}.etapas
                        (obra_cod,nome,dt_inicio,dt_fim,responsavel,peso,avanco_fisico,obs)
                    VALUES (?,?,?,?,?,?,?,?)
                """, [o["cod"], e.get("nome"), e.get("dtInicio"), e.get("dtFim"),
                      e.get("responsavel"), e.get("peso",1), e.get("avancoFisico",0), e.get("obs")])

        async def salvar_lanc(l):
            await arun_exec(f"""
                MERGE INTO {S_OBRAS}.lancamentos AS t
                USING (SELECT ? AS id) AS s ON t.id = s.id
                WHEN MATCHED THEN UPDATE SET
                    obraCod=?,cresp=?,categoria=?,subcategoria=?,descricao=?,unid=?,
                    qtd=?,precoUnit=?,nfDoc=?,dtLanc=?,fornecedor=?,obs=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT
                    (id,obraCod,cresp,categoria,subcategoria,descricao,unid,
                     qtd,precoUnit,nfDoc,dtLanc,fornecedor,obs,atualizado_por)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, [
                l["id"], l.get("obraCod"), l.get("cresp"), l.get("categoria"),
                l.get("subcategoria"), l.get("descricao"), l.get("unid"),
                l.get("qtd"), l.get("precoUnit"), l.get("nfDoc"),
                l.get("dtLanc"), l.get("fornecedor"), l.get("obs"), u,
                l["id"], l.get("obraCod"), l.get("cresp"), l.get("categoria"),
                l.get("subcategoria"), l.get("descricao"), l.get("unid"),
                l.get("qtd"), l.get("precoUnit"), l.get("nfDoc"),
                l.get("dtLanc"), l.get("fornecedor"), l.get("obs"), u
            ])

        async def salvar_budget(b):
            await arun_exec(f"""
                MERGE INTO {S_OBRAS}.budget AS t
                USING (SELECT ? AS id) AS s ON t.id = s.id
                WHEN MATCHED THEN UPDATE SET
                    obraCod=?,cresp=?,tipoVerba=?,budgetAprov=?,capex=?,opex=?,contingencia=?,obs=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT
                    (id,obraCod,cresp,tipoVerba,budgetAprov,capex,opex,contingencia,obs,atualizado_por)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
            """, [
                b.get("id"), b.get("obraCod"), b.get("cresp"), b.get("tipoVerba"),
                b.get("budgetAprov"), b.get("capex",0), b.get("opex",0),
                b.get("contingencia",0), b.get("obs"), u,
                b.get("id"), b.get("obraCod"), b.get("cresp"), b.get("tipoVerba"),
                b.get("budgetAprov"), b.get("capex",0), b.get("opex",0),
                b.get("contingencia",0), b.get("obs"), u
            ])
        await asyncio.gather(
            *[salvar_obra(o) for o in body.get("obras", [])],
            *[salvar_lanc(l) for l in body.get("lancamentos", [])],
            *[salvar_budget(b) for b in body.get("budget", [])],
        )
    except Exception as e:
        print(f"[obras] erro ao salvar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("obras")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_obras)
    return JSONResponse({"ok": True})

@app.delete("/api/obras/{cod}")
async def delete_obra(cod: str):
    try:
        await arun_exec(f"DELETE FROM {S_OBRAS}.obras WHERE cod=?", [cod])
        await arun_exec(f"DELETE FROM {S_OBRAS}.etapas WHERE obra_cod=?", [cod])
    except Exception as e:
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("obras")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_obras)
    return JSONResponse({"ok": True})

@app.delete("/api/obras/budget/{bid}")
async def delete_budget(bid: str):
    try:
        await arun_exec(f"DELETE FROM {S_OBRAS}.budget WHERE id=?", [bid])
    except Exception as e:
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("obras")
    return JSONResponse({"ok": True})

@app.delete("/api/obras/lancamento/{lid}")
async def delete_lancamento(lid: str):
    try:
        await arun_exec(f"DELETE FROM {S_OBRAS}.lancamentos WHERE id=?", [lid])
    except Exception as e:
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("obras")
    return JSONResponse({"ok": True})

# ─── CODIN ────────────────────────────────────────────────────────────────────
@app.get("/api/codin")
async def get_codin():
    return JSONResponse(get_cached("codin"))

@app.post("/api/codin")
async def save_codin(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        for p in body.get("pessoas", []):
            await arun_exec(f"""
                MERGE INTO {S_CODIN}.pessoas AS t
                USING (SELECT ? AS id) AS s ON t.id = s.id
                WHEN MATCHED THEN UPDATE SET
                    nome=?,cargo=?,setor=?,status=?,lib=?,obs=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT (id,nome,cargo,setor,status,lib,obs,atualizado_por)
                    VALUES (?,?,?,?,?,?,?,?)
            """, [
                p["id"], p.get("nome"), p.get("cargo"), p.get("setor"),
                p.get("status"), p.get("lib"), p.get("obs"), u,
                p["id"], p.get("nome"), p.get("cargo"), p.get("setor"),
                p.get("status"), p.get("lib"), p.get("obs"), u
            ])
        for p in body.get("pontos", []):
            ponto_id = p.get("id") or p.get("codin") or p.get("nome")
            await arun_exec(f"""
                MERGE INTO {S_CODIN}.pontos AS t
                USING (SELECT ? AS id) AS s ON t.id = s.id
                WHEN MATCHED THEN UPDATE SET
                    nome=?,codin=?,tipo=?,senhaHash=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT (id,nome,codin,tipo,senhaHash,atualizado_por)
                    VALUES (?,?,?,?,?,?)
            """, [
                ponto_id, p.get("nome"), p.get("codin"), p.get("tipo"), p.get("senhaHash"), u,
                ponto_id, p.get("nome"), p.get("codin"), p.get("tipo"), p.get("senhaHash"), u
            ])
            await arun_exec(f"DELETE FROM {S_CODIN}.ponto_leitores WHERE ponto_id=?", [ponto_id])
            for leitor in p.get("leitores", []):
                await arun_exec(f"INSERT INTO {S_CODIN}.ponto_leitores (ponto_id, leitor_id) VALUES (?,?)",
                    [ponto_id, leitor])
    except Exception as e:
        print(f"[codin] erro ao salvar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("codin")
    return JSONResponse({"ok": True})

@app.get("/codin-qr/codinqr.css")
async def codinqr_css():
    return FileResponse(f"{BASE}/codinqr/codinqr.css", media_type="text/css")

@app.get("/codin-qr/codinqr.js")
async def codinqr_js():
    return FileResponse(f"{BASE}/codinqr/codinqr.js", media_type="application/javascript")

@app.get("/codin-qr/{codin_id}")
async def codin_qr_page(codin_id: str):
    return FileResponse(f"{BASE}/codinqr/codinqr.html")

@app.get("/api/codin/solicitacoes")
async def listar_solicitacoes_codin():
    rows = await arun_query(f"SELECT * FROM {S_CODIN}.solicitacoes ORDER BY data DESC")
    return JSONResponse({"solicitacoes": rows})

@app.post("/api/codin/solicitacoes")
async def criar_solicitacao_codin(request: Request):
    body = await request.json()
    try:
        await arun_exec(f"""
            INSERT INTO {S_CODIN}.solicitacoes (id, codin, nome, email, cargo, setor, motivo, status, data)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, [
            body["id"], body.get("codin"), body.get("nome"), body.get("email"),
            body.get("cargo"), body.get("setor"), body.get("motivo"),
            body.get("status", "Pendente"), body.get("data")
        ])
    except Exception as e:
        print(f"[codin] erro ao criar solicitacao: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    return JSONResponse({"ok": True})

@app.put("/api/codin/solicitacoes/{sid}")
async def atualizar_solicitacao_codin(sid: str, request: Request):
    body = await request.json()
    novo_status = body["status"]
    try:
        if novo_status in ("Aprovada", "Rejeitada"):
            await arun_exec(
                f"UPDATE {S_CODIN}.solicitacoes SET status=?, data_resposta=current_timestamp() WHERE id=?",
                [novo_status, sid]
            )
        else:
            await arun_exec(f"UPDATE {S_CODIN}.solicitacoes SET status=? WHERE id=?", [novo_status, sid])
    except Exception as e:
        print(f"[codin] erro ao atualizar solicitacao: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    return JSONResponse({"ok": True})

# ─── Conforto ─────────────────────────────────────────────────────────────────

@app.get("/api/conforto")
async def get_conforto():
    return JSONResponse(get_cached("conforto"))

# ─── Conforto ─────────────────────────────────────────────────────────────────

async def _salvar_ucs(body, u):
    ids_front = [uc["id"] for uc in body.get("ucs", [])]
    if ids_front:
        placeholders = ",".join(["?" for _ in ids_front])
        await arun_exec(
            f"DELETE FROM {S_CONFORTO}.ucs WHERE id NOT IN ({placeholders}) AND atualizado_por != 'import'",
            ids_front
        )
    else:
        await arun_exec(f"DELETE FROM {S_CONFORTO}.ucs WHERE atualizado_por != 'import'")
    for uc in body.get("ucs", []):
        await arun_exec(f"""
            MERGE INTO {S_CONFORTO}.ucs AS t
            USING (SELECT ? AS id) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                codigo=?, nome=?, categoria=?, local=?, modelo=?,
                capacidade_btu=?, tipo=?, data_instalacao=?,
                ciclo_filtro_dias=?, responsavel_id=?, obs=?,
                fabricante=?, serie=?, status_op=?,
                intervalo_prev_dias=?, ultima_limpeza_filtro=?,
                checklist_proprio=?, atualizado_por=?
            WHEN NOT MATCHED THEN INSERT
                (id,codigo,nome,categoria,local,modelo,capacidade_btu,tipo,
                 data_instalacao,ciclo_filtro_dias,responsavel_id,obs,
                 fabricante,serie,status_op,intervalo_prev_dias,
                 ultima_limpeza_filtro,checklist_proprio,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            uc["id"],
            uc.get("codigo"), uc.get("nome"), uc.get("categoria"),
            uc.get("local"), uc.get("modelo"), uc.get("capacidadeBtu"),
            uc.get("tipo"), to_date_or_none(uc.get("dataInstalacao")),
            uc.get("cicloFiltroDias"), uc.get("responsavelId"), uc.get("obs"),
            uc.get("fabricante"), uc.get("serie"), uc.get("statusOp", "Operacional"),
            uc.get("intervaloPrevDias", 0), to_date_or_none(uc.get("ultimaLimpezaFiltro")),
            json.dumps(uc.get("checklistProprio", [])), u,
            uc["id"], uc.get("codigo"), uc.get("nome"), uc.get("categoria"),
            uc.get("local"), uc.get("modelo"), uc.get("capacidadeBtu"),
            uc.get("tipo"), to_date_or_none(uc.get("dataInstalacao")),
            uc.get("cicloFiltroDias"), uc.get("responsavelId"), uc.get("obs"),
            uc.get("fabricante"), uc.get("serie"), uc.get("statusOp", "Operacional"),
            uc.get("intervaloPrevDias", 0), to_date_or_none(uc.get("ultimaLimpezaFiltro")),
            json.dumps(uc.get("checklistProprio", [])), u
        ])

async def _salvar_preventivas(body, u):
    ids_front = [p["id"] for p in body.get("preventivas", [])]
    if ids_front:
        placeholders = ",".join(["?" for _ in ids_front])
        await arun_exec(
            f"DELETE FROM {S_CONFORTO}.preventivas WHERE id NOT IN ({placeholders}) AND origem != 'qr'",
            ids_front
        )
    else:
        await arun_exec(f"DELETE FROM {S_CONFORTO}.preventivas WHERE origem != 'qr'")
    for p in body.get("preventivas", []):
        await arun_exec(f"""
            MERGE INTO {S_CONFORTO}.preventivas AS t
            USING (SELECT ? AS id, ? AS uc_id, ? AS tecnico_id,
                ? AS data_prevista, ? AS data_realizada, ? AS status,
                ? AS checklist, ? AS obs, ? AS origem, ? AS atualizado_por
            ) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                uc_id=s.uc_id, tecnico_id=s.tecnico_id,
                data_prevista=s.data_prevista, data_realizada=s.data_realizada,
                status=s.status, checklist=s.checklist, obs=s.obs,
                origem=s.origem, atualizado_por=s.atualizado_por
            WHEN NOT MATCHED THEN INSERT
                (id,uc_id,tecnico_id,data_prevista,data_realizada,
                 status,checklist,obs,origem,atualizado_por)
            VALUES (s.id,s.uc_id,s.tecnico_id,s.data_prevista,s.data_realizada,
                 s.status,s.checklist,s.obs,s.origem,s.atualizado_por)
        """, [
            p["id"], p.get("ucId"), p.get("tecnicoId"),
            to_date_or_none(p.get("dataPrevista")), to_date_or_none(p.get("dataRealizada")),
            p.get("status"), json.dumps(p.get("checklist", [])),
            p.get("obs"), p.get("origem", "manual"), u
        ])

async def _salvar_tecnicos(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.tecnicos")
    for t in body.get("tecnicos", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.tecnicos
                (id,nome,matricula,especialidade,turno,atualizado_por)
            VALUES (?,?,?,?,?,?)
        """, [
            t["id"], t.get("nome"), t.get("matricula"),
            t.get("especialidade"), t.get("turno"), u
        ])

async def _salvar_ordens(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.ordens")
    for o in body.get("ordens", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.ordens
                (id,tipo,area_id,responsavel_id,data_prevista,data_realizada,
                 status,hora_inicio,hora_fim,obs,origem_rotina,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            o["id"], o.get("tipo"), o.get("areaId"), o.get("responsavelId"),
            to_date_or_none(o.get("dataPrevista")), to_date_or_none(o.get("dataRealizada")),
            o.get("status"), o.get("horaInicio", "08:00"), o.get("horaFim", "09:00"),
            o.get("obs"), o.get("origemRotina"), u
        ])

async def _salvar_manutencoes(body, u):
    ids_front = [m["id"] for m in body.get("manutencoes", [])]
    if ids_front:
        placeholders = ",".join(["?" for _ in ids_front])
        await arun_exec(
            f"DELETE FROM {S_CONFORTO}.manutencoes WHERE id NOT IN ({placeholders}) AND (atualizado_por IS NULL OR atualizado_por != 'qr')",
            ids_front
        )
    else:
        await arun_exec(f"DELETE FROM {S_CONFORTO}.manutencoes WHERE atualizado_por != 'qr'")
    for m in body.get("manutencoes", []):
        await arun_exec(f"""
            MERGE INTO {S_CONFORTO}.manutencoes AS t
            USING (SELECT ? AS id) AS s ON t.id = s.id
            WHEN MATCHED AND t.atualizado_por != 'qr' THEN UPDATE SET
                uc_id=?, tecnico_id=?, tipo=?, falha=?, data_abertura=?,
                data_fechamento=?, status=?, custo_estimado=?,
                pecas_utilizadas=?, obs=?, atualizado_por=?
            WHEN NOT MATCHED THEN INSERT
                (id,uc_id,tecnico_id,tipo,falha,data_abertura,data_fechamento,
                 status,custo_estimado,pecas_utilizadas,obs,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            m["id"],
            m.get("ucId"), m.get("tecnicoId"), m.get("tipo","Manutenção"), m.get("falha"),
            to_date_or_none(m.get("dataAbertura")), to_date_or_none(m.get("dataFechamento")),
            m.get("status"), m.get("custoEstimado", 0), m.get("pecasUtilizadas"), m.get("obs"), u,
            m["id"], m.get("ucId"), m.get("tecnicoId"), m.get("tipo","Manutenção"), m.get("falha"),
            to_date_or_none(m.get("dataAbertura")), to_date_or_none(m.get("dataFechamento")),
            m.get("status"), m.get("custoEstimado", 0), m.get("pecasUtilizadas"), m.get("obs"), u
        ])

async def _salvar_pecas(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.pecas")
    for p in body.get("pecas", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.pecas
                (id,codigo,descricao,categoria,fabricante,referencia,
                 unidade,estq_atual,estq_minimo,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, [
            p["id"], p.get("codigo"), p.get("descricao"), p.get("categoria"),
            p.get("fabricante"), p.get("referencia"), p.get("unidade"),
            p.get("estqAtual", 0), p.get("estqMinimo", 0), u
        ])

async def _salvar_requisicoes(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.requisicoes")
    for r in body.get("requisicoes", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.requisicoes
                (id,peca_id,quantidade,destino,solicitante_id,
                 data_necessidade,status,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?)
        """, [
            r["id"], r.get("pecaId"), r.get("quantidade"), r.get("destino"),
            r.get("solicitanteId"), to_date_or_none(r.get("dataNecessidade")),
            r.get("status"), u
        ])

async def _salvar_areas(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.areas")
    for a in body.get("areas", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.areas
                (id,nome,local,tipo,metragem,freq_civil,
                 freq_tecnica,responsavel_id,obs,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, [
            a["id"], a.get("nome"), a.get("local"), a.get("tipo"),
            a.get("metragem", 0), a.get("freqCivil"), a.get("freqTecnica"),
            a.get("responsavelId"), a.get("obs"), u
        ])

async def _salvar_fornecedores(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.fornecedores")
    for f in body.get("fornecedores", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.fornecedores
                (id,nome,cnpj,tipo_servico,contato,telefone,email,ativo,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, [
            f["id"], f.get("nome"), f.get("cnpj"), f.get("tipoServico"),
            f.get("contato"), f.get("telefone"), f.get("email"),
            f.get("ativo", "Sim"), u
        ])

async def _salvar_rotinas(body, u):
    await arun_exec(f"DELETE FROM {S_CONFORTO}.rotinas")
    for r in body.get("rotinas", []):
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.rotinas
                (id,nome,tipo,area_id,responsavel_id,frequencia,
                 dias_semana,hora_inicio,hora_fim,ativa,atualizado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, [
            r["id"], r.get("nome"), r.get("tipo"), r.get("areaId"),
            r.get("responsavelId"), r.get("frequencia"),
            json.dumps(r.get("diasSemana", [])),
            r.get("horaInicio", "08:00"), r.get("horaFim", "09:00"),
            r.get("ativa", True), u
        ])

@app.get("/api/conforto")

@app.post("/api/conforto")
async def save_conforto(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        await _salvar_ucs(body, u)
        await _salvar_preventivas(body, u)
        await _salvar_tecnicos(body, u)
        await _salvar_ordens(body, u)
        await _salvar_manutencoes(body, u)
        await _salvar_pecas(body, u)
        await _salvar_requisicoes(body, u)
        await _salvar_areas(body, u)
        await _salvar_fornecedores(body, u)
        await _salvar_rotinas(body, u)
        if "config" in body:
            c = body["config"]
            await arun_exec(f"DELETE FROM {S_CONFORTO}.config")
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.config
                    (ciclo_filtro_dias,alerta_preventiva_dias,alerta_limpeza_dias,
                     alerta_manutencao_dias,checklist_preventiva,
                     frequencias_escritorio,frequencias_banheiro,frequencias_refeitorio,
                     frequencias_area_tecnica,frequencias_corredor,frequencias_almoxarifado)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, [
                c.get("cicloFiltroDias", 90), c.get("alertaPreventivaDias", 7),
                c.get("alertaLimpezaDias", 2), c.get("alertaManutencaoDias", 3),
                json.dumps(c.get("checklistPreventiva", [])),
                c.get("frequencias", {}).get("escritorio", "Diário"),
                c.get("frequencias", {}).get("banheiro", "Diário"),
                c.get("frequencias", {}).get("refeitorio", "Diário"),
                c.get("frequencias", {}).get("areaTecnica", "Semanal"),
                c.get("frequencias", {}).get("corredor", "Semanal"),
                c.get("frequencias", {}).get("almoxarifado", "Quinzenal"),
            ])
        cache_invalidate("conforto")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _load_conforto)
        return JSONResponse({"ok": True})
    except Exception as e:
        import traceback
        print(f"[save_conforto] erro: {e}")
        print(traceback.format_exc())
        return JSONResponse({"erro": str(e)}, status_code=500)

# ─── Atividades ───────────────────────────────────────────────────────────────
@app.get("/api/atividades")
async def get_atividades():
    return JSONResponse(get_cached("atividades"))

@app.post("/api/atividades")
async def save_atividades(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        for a in body.get("atividades", []):
            await arun_exec(f"""
                MERGE INTO {S_ATIVIDADES}.atividades AS t
                USING (SELECT ? AS id) AS s ON t.id = s.id
                WHEN MATCHED THEN UPDATE SET
                    titulo=?,`desc`=?,status=?,prioridade=?,responsavel=?,obra=?,
                    prazo=?,progresso=?,tags=?,criadoPor=?,criadoEm=?,
                    atualizado_em=current_timestamp(),atualizado_por=?
                WHEN NOT MATCHED THEN INSERT
                    (id,titulo,`desc`,status,prioridade,responsavel,obra,
                     prazo,progresso,tags,criadoPor,criadoEm,atualizado_por)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, [
                a["id"],
                a.get("titulo"), a.get("desc"), a.get("status"), a.get("prioridade"),
                a.get("responsavel"), a.get("obra"), a.get("prazo"), a.get("progresso", 0),
                a.get("tags"), a.get("criadoPor"), a.get("criadoEm"), u,
                a["id"],
                a.get("titulo"), a.get("desc"), a.get("status"), a.get("prioridade"),
                a.get("responsavel"), a.get("obra"), a.get("prazo"), a.get("progresso", 0),
                a.get("tags"), a.get("criadoPor"), a.get("criadoEm"), u
            ])
            # só atualiza comentários se o payload tem comentários (evita apagar os existentes)
            if "comentarios" in a:
                await arun_exec(f"DELETE FROM {S_ATIVIDADES}.comentarios WHERE atividade_id=?", [a["id"]])
                for c in a.get("comentarios", []):
                    await arun_exec(f"""
                        INSERT INTO {S_ATIVIDADES}.comentarios (atividade_id, autor, texto)
                        VALUES (?,?,?)
                    """, [a["id"], c.get("autor"), c.get("texto")])
    except Exception as e:
        print(f"[atividades] erro ao salvar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("atividades")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_atividades)
    return JSONResponse({"ok": True})

@app.delete("/api/atividades/{aid}")
async def delete_atividade(aid: str):
    try:
        await arun_exec(f"DELETE FROM {S_ATIVIDADES}.atividades WHERE id=?", [aid])
        await arun_exec(f"DELETE FROM {S_ATIVIDADES}.comentarios WHERE atividade_id=?", [aid])
    except Exception as e:
        print(f"[atividades] erro ao excluir {aid}: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("atividades")
    return JSONResponse({"ok": True})

@app.post("/api/atividades/{aid}/comentarios")
async def add_comentario(aid: str, request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        await arun_exec(f"""
            INSERT INTO {S_ATIVIDADES}.comentarios (atividade_id, autor, texto, data)
            VALUES (?,?,?,current_timestamp())
        """, [aid, body.get("autor"), body.get("texto")])
    except Exception as e:
        print(f"[comentario] erro: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("atividades")
    return JSONResponse({"ok": True})

@app.post("/api/atividades/{aid}/comentarios/rewrite")
async def rewrite_comentarios(aid: str, request: Request):
    body = await request.json()
    try:
        await arun_exec(f"DELETE FROM {S_ATIVIDADES}.comentarios WHERE atividade_id=?", [aid])
        for c in body.get("comentarios", []):
            await arun_exec(f"""
                INSERT INTO {S_ATIVIDADES}.comentarios (atividade_id, autor, texto)
                VALUES (?,?,?)
            """, [aid, c.get("autor"), c.get("texto")])
    except Exception as e:
        print(f"[comentario] erro ao reescrever: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("atividades")
    return JSONResponse({"ok": True})

# ─── Hub ──────────────────────────────────────────────────────────────────────
@app.get("/api/hub/config")
async def get_hub_config(request: Request):
    usuario = get_usuario(request)
    key = f"hub_config_{usuario}"
    v = cache_get(key)
    if v is not None:
        return JSONResponse(v)
    try:
        pessoas   = await arun_query(f"SELECT * FROM {S_HUB}.pessoas")
        cresp     = await arun_query(f"SELECT * FROM {S_HUB}.cresp")
        tipos     = await arun_query(f"SELECT nome FROM {S_HUB}.tipos_obra")
        cats      = await arun_query(f"SELECT * FROM {S_HUB}.categorias_custo")
        leitores  = await arun_query(f"SELECT * FROM {S_HUB}.leitores")
        dados = {
            "pessoas":         pessoas,
            "cresp":           cresp,
            "tiposObra":       [r["nome"] for r in tipos],
            "categoriasCusto": cats,
            "leitores":        leitores,
        }
    except Exception as e:
        print(f"[hub/config] erro ao ler: {e}")
        dados = {}
    cache_set(key, dados)
    return JSONResponse(dados)

@app.post("/api/hub/config")
async def save_hub_config(request: Request):
    dados   = await request.json()
    usuario = get_usuario(request)
    try:
        await arun_exec(f"DELETE FROM {S_HUB}.pessoas")
        for p in dados.get("pessoas", []):
            await arun_exec(f"INSERT INTO {S_HUB}.pessoas (id, nome, cargo) VALUES (?,?,?)",
                [p.get("id"), p.get("nome"), p.get("cargo")])
        await arun_exec(f"DELETE FROM {S_HUB}.cresp")
        for c in dados.get("cresp", []):
            await arun_exec(f"INSERT INTO {S_HUB}.cresp (id, descricao, area) VALUES (?,?,?)",
                [c.get("id"), c.get("descricao"), c.get("area")])
        await arun_exec(f"DELETE FROM {S_HUB}.tipos_obra")
        for nome in dados.get("tiposObra", []):
            await arun_exec(f"INSERT INTO {S_HUB}.tipos_obra (nome) VALUES (?)", [nome])
        await arun_exec(f"DELETE FROM {S_HUB}.categorias_custo")
        for cat in dados.get("categoriasCusto", []):
            await arun_exec(f"INSERT INTO {S_HUB}.categorias_custo (categoria, subcategoria) VALUES (?,?)",
                [cat.get("categoria"), cat.get("subcategoria")])
        await arun_exec(f"DELETE FROM {S_HUB}.leitores")
        for l in dados.get("leitores", []):
            await arun_exec(f"INSERT INTO {S_HUB}.leitores (id, nome) VALUES (?,?)",
                [l.get("id"), l.get("nome")])
    except Exception as e:
        print(f"[hub/config] erro ao salvar: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_set(f"hub_config_{usuario}", dados)
    return JSONResponse({"ok": True})

@app.get("/api/hub/dados")
async def get_hub_dados():
    ch = get_cached("chamados")
    ob = get_cached("obras")
    c  = ch.get("chamados", [])
    o  = ob.get("obras", [])
    l  = ob.get("lancamentos", [])
    return JSONResponse({
        "chamados": {
            "total":      len(c),
            "abertos":    len([x for x in c if x.get("status") == "Aberto"]),
            "andamento":  len([x for x in c if x.get("status") == "Em Andamento"]),
            "concluidos": len([x for x in c if x.get("status") == "Concluido"]),
            "criticos":   len([x for x in c if x.get("prioridade") == "Critica"
                               and x.get("status") not in ["Concluido", "Cancelado"]]),
        },
        "obras": {
            "total":       len(o),
            "andamento":   len([x for x in o if x.get("status") == "Em Andamento"]),
            "concluidas":  len([x for x in o if x.get("status") == "Concluido"]),
            "gasto_total": sum(x.get("precoUnit", 0) * x.get("qtd", 1) for x in l),
        }
    })

@app.get("/api/kpi/dados")
async def get_kpi():
    return JSONResponse({
        "chamados":   get_cached("chamados"),
        "obras":      get_cached("obras"),
        "atividades": get_cached("atividades"),
        "conforto":   get_cached("conforto"),
    })

# ─── Páginas HTML ─────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return inject(f"{BASE}/hub/hub.html", {})

@app.get("/hub")
async def hub():
    return inject(f"{BASE}/hub/hub.html", {})

@app.get("/chamados")
async def chamados_page():
    return inject(f"{BASE}/chamados/chamados.html", get_cached("chamados"))

@app.get("/obras")
async def obras_page():
    return FileResponse(f"{BASE}/obras/obras.html")

@app.get("/codin")
async def codin_page():
    return inject(f"{BASE}/codins/codin.html", get_cached("codin"))

@app.get("/conforto")
async def conforto_page():
    return inject(f"{BASE}/conforto/conforto.html", get_cached("conforto"))

@app.get("/atividades")
async def atividades_page():
    return inject(f"{BASE}/atividades/atividades.html", get_cached("atividades"))

@app.get("/qr/qr.css")
async def qr_css():
    return FileResponse(f"{BASE}/qr/qr.css", media_type="text/css")

@app.get("/qr/qr.js")
async def qr_js():
    return FileResponse(f"{BASE}/qr/qr.js", media_type="application/javascript")

@app.get("/qr/qrcode.min.js")
async def qr_lib():
    return FileResponse(f"{BASE}/qr/qrcode.min.js", media_type="application/javascript")

@app.get("/qr/{area}")
async def qr_abrir_chamado(area: str):
    return FileResponse(f"{BASE}/qr/qr.html")

@app.get("/servicedesk")
async def servicedesk_page():
    return inject(f"{BASE}/servicedesk/servicedesk.html", get_cached("chamados"))

@app.get("/kpi")
async def kpi_page():
    return inject(f"{BASE}/kpi/kpi.html", {
        "chamados":   get_cached("chamados"),
        "obras":      get_cached("obras"),
        "atividades": get_cached("atividades"),
        "conforto":   get_cached("conforto"),
    })

@app.get("/admin")
async def admin_page():
    return FileResponse(f"{BASE}/admin/admin.html")

@app.get("/login")
async def login_page():
    return FileResponse(f"{BASE}/login/login.html")

@app.get("/app.webmanifest")
async def webmanifest():
    return FileResponse(f"{BASE}/manifest.json", media_type="application/manifest+json")

@app.get("/sw.js")
async def service_worker():
    return FileResponse(f"{BASE}/sw.js", media_type="application/javascript",
                        headers={"Service-Worker-Allowed": "/"})

@app.get("/manifest.json")
async def manifest():
    return FileResponse(f"{BASE}/manifest.json", media_type="application/manifest+json")

@app.get("/favicon.ico")
async def favicon():
    path = f"{BASE}/icons/icon-192.png"
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    from fastapi.responses import Response
    return Response(status_code=204)

@app.get("/icons/icon-192.png")
async def icon192():
    path = f"{BASE}/icons/icon-192.png"
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    from fastapi.responses import Response
    return Response(status_code=204)

@app.get("/conforto-prev/prev.css")
async def prev_css():
    return FileResponse(f"{BASE}/confortoprev/prev.css", media_type="text/css")

@app.get("/conforto-prev/prev.js")
async def prev_js():
    return FileResponse(f"{BASE}/confortoprev/prev.js", media_type="application/javascript")

@app.get("/conforto-prev/portal")
async def portal_page(request: Request):
    html_path = f"{BASE}/confortoprev/portal.html"
    dados = get_cached("conforto")
    pecas = dados.get("pecas", [])
    html  = inject(html_path, {"pecas": pecas})
    html.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    html.headers["Pragma"] = "no-cache"
    return html

@app.get("/conforto-prev/{uc_id}")
async def prev_page(uc_id: str, request: Request):
    try:
        ucs_rows = await arun_query(f"SELECT * FROM {S_CONFORTO}.ucs WHERE id=? LIMIT 1", [uc_id])
        uc = None
        if ucs_rows:
            u = ucs_rows[0]
            uc = {
                "id":              u.get("id"),
                "codigo":          u.get("codigo"),
                "nome":            u.get("nome"),
                "local":           u.get("local"),
                "modelo":          u.get("modelo"),
                "categoria":       u.get("categoria") or "Ar-Condicionado",
                "tipo":            u.get("tipo"),
                "capacidadeBtu":   u.get("capacidade_btu"),
                "dataInstalacao":  str(u.get("data_instalacao") or ""),
                "cicloFiltroDias": u.get("ciclo_filtro_dias"),
                "responsavelId":   u.get("responsavel_id"),
                "obs":             u.get("obs") or "",
                "checklistProprio": (
                    json.loads(u["checklist_proprio"])
                    if u.get("checklist_proprio") and isinstance(u.get("checklist_proprio"), str)
                    else (u.get("checklist_proprio") or [])
                ),
            }
        config_rows = await arun_query(f"SELECT checklist_preventiva FROM {S_CONFORTO}.config LIMIT 1")
        checklist_global = []
        if config_rows and config_rows[0].get("checklist_preventiva"):
            try:
                checklist_global = json.loads(config_rows[0]["checklist_preventiva"])
            except:
                checklist_global = []
        checklist = (uc.get("checklistProprio") or []) if uc else []
        if not checklist:
            checklist = checklist_global
    except Exception as e:
        import traceback
        print(f"[prev_page] erro ao buscar UC {uc_id}: {e}")
        print(traceback.format_exc())
        uc = None
        checklist = []
    from fastapi.responses import HTMLResponse
    tec_rows = await arun_query(f"SELECT nome FROM {S_CONFORTO}.tecnicos ORDER BY nome")
    tecnicos_nomes = [t["nome"] for t in tec_rows] if tec_rows else []
    html = inject(f"{BASE}/confortoprev/prev.html", {
        "uc": uc, "checklist": checklist, "uc_id": uc_id, "tecnicos": tecnicos_nomes
    })
    html.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    html.headers["Pragma"] = "no-cache"
    return html

@app.post("/api/conforto/preventivas")
async def criar_preventiva_qr(request: Request):
    body = await request.json()
    try:
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.preventivas
                (id, uc_id, tecnico_id, data_prevista, data_realizada, status,
                 checklist, obs, origem, atualizado_por,
                 inicio_em, fim_em, duracao_min, num_pessoas,
                 tecnicos, foto_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            body["id"], body.get("ucId"), None,
            body.get("dataPrevista"), body.get("dataRealizada", body.get("dataPrevista")),
            body.get("status", "Realizada"),
            json.dumps(body.get("checklist", [])),
            body.get("obs", ""),
            "qr", json.dumps(body.get("tecnicos", [])),
            body.get("inicioEm"), body.get("fimEm"),
            body.get("duracaoMin"), body.get("numPessoas"),
            json.dumps(body.get("tecnicos", [])),
            body.get("foto")
        ])
    except Exception as e:
        print(f"[conforto] erro ao criar preventiva qr: {e}")
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("conforto")
    return JSONResponse({"ok": True})

@app.post("/api/conforto/manutencoes-qr")
async def criar_manutencao_qr(request: Request):
    body = await request.json()
    try:
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.manutencoes
                (id, uc_id, tecnico_id, tipo, falha, data_abertura, data_fechamento,
                 status, custo_estimado, pecas_utilizadas, obs, atualizado_por,
                 inicio_em, fim_em, duracao_min, num_pessoas, tecnicos, foto_url, pausas)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            body["id"], body.get("ucId"), None,
            body.get("tipo", "Corretiva"),
            body.get("falha", ""),
            body.get("dataAbertura"), body.get("dataFechamento"),
            body.get("status", "Em Aberto"),
            0,
            json.dumps(body.get("pecasSelecionadas", [])),
            f"[QR] Técnicos: {', '.join(body.get('tecnicos', []))} | {body.get('obs','')}".strip(' |'),
            "qr",
            body.get("inicioEm"), body.get("fimEm"),
            body.get("duracaoMin"), body.get("numPessoas"),
            json.dumps(body.get("tecnicos", [])),
            body.get("foto"),
            json.dumps([])
        ])
        cache_invalidate("conforto")
        asyncio.create_task(asyncio.to_thread(_load_conforto))
        return JSONResponse({"ok": True})
    except Exception as e:
        import traceback
        print(f"[manutencao_qr] erro: {e}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)

@app.put("/api/conforto/manutencoes/{mid}")
async def atualizar_manutencao(mid: str, request: Request):
    body = await request.json()
    try:
        sets = []
        vals = []
        if "status" in body:
            sets.append("status=?"); vals.append(body["status"])
        if "fimEm" in body:
            sets.append("fim_em=?"); vals.append(body["fimEm"])
        if "duracaoMin" in body:
            sets.append("duracao_min=?"); vals.append(body["duracaoMin"])
        if "pausas" in body:
            sets.append("pausas=?"); vals.append(json.dumps(body["pausas"]))
        if "obs" in body:
            sets.append("obs=?"); vals.append(body["obs"])
        if not sets:
            return JSONResponse({"ok": True})
        vals.append(mid)
        await arun_exec(
            f"UPDATE {S_CONFORTO}.manutencoes SET {', '.join(sets)} WHERE id=?",
            vals
        )
        cache_invalidate("conforto")
        asyncio.create_task(asyncio.to_thread(_load_conforto))
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    
@app.get("/api/conforto/manutencoes/{mid}")
async def get_manutencao(mid: str, request: Request):
    try:
        rows = await arun_query(
            f"SELECT * FROM {S_CONFORTO}.manutencoes WHERE id=? LIMIT 1", [mid]
        )
        if not rows:
            return JSONResponse({"error": "not found"}, status_code=404)
        m = rows[0]
        return JSONResponse({
            "id":         m.get("id"),
            "ucId":       m.get("uc_id"),
            "tipo":       m.get("tipo") or "Manutenção",
            "falha":      m.get("falha") or "",
            "obs":        m.get("obs") or "",
            "status":     m.get("status"),
            "tecnicos":   (json.loads(m.get("tecnicos")) if m.get("tecnicos") else []),
            "numPessoas": m.get("num_pessoas"),
            "pausas":     (json.loads(m.get("pausas")) if m.get("pausas") else []),
            "duracaoMin": m.get("duracao_min") or 0,
            "inicioEm":   _ts(m.get("inicio_em")) or "",
        }, default=str)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/conforto/manutencoes/{mid}/concluir")
async def concluir_manutencao(mid: str, request: Request):
    body = await request.json()
    try:
        duracao_anterior = body.get("duracaoAnteriorMin", 0) or 0
        duracao_atual    = body.get("duracaoMin", 0) or 0
        duracao_total    = duracao_anterior + duracao_atual
        pausas = body.get("pausasAnteriores", []) or []
        pausas.append({
            "motivo": None,
            "inicio": body.get("inicioEm"),
            "fim":    body.get("fimEm"),
            "duracaoMin": duracao_atual
        })
        await arun_exec(f"""
            UPDATE {S_CONFORTO}.manutencoes SET
                status=?, fim_em=?, duracao_min=?, num_pessoas=?,
                tecnicos=?, foto_url=?, pausas=?, obs=?, atualizado_por=?
            WHERE id=?
        """, [
            "Concluída",
            body.get("fimEm"),
            duracao_total,
            body.get("numPessoas"),
            json.dumps(body.get("tecnicos", [])),
            body.get("foto"),
            json.dumps(pausas),
            body.get("obs", ""),
            "qr",
            mid
        ])
        cache_invalidate("conforto")
        asyncio.create_task(asyncio.to_thread(_load_conforto))
        return JSONResponse({"ok": True, "duracaoTotal": duracao_total})
    except Exception as e:
        import traceback
        print(f"[concluir_manutencao] erro: {e}")
        print(traceback.format_exc())
        return JSONResponse({"error": str(e)}, status_code=500)
    
@app.post("/api/conforto/requisicoes-qr")
async def criar_requisicao_qr(request: Request):
    body = await request.json()
    try:
        for req in body.get("requisicoes", []):
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.requisicoes
                    (id, peca_id, quantidade, destino, solicitante_id,
                     data_necessidade, status, atualizado_por)
                VALUES (?,?,?,?,?,?,?,?)
            """, [
                req["id"], req.get("pecaId"), req.get("quantidade", 1),
                req.get("destino", "Manutenção QR"),
                req.get("solicitante", "qr"),
                None, "Pendente", "qr"
            ])
        cache_invalidate("conforto")
        asyncio.create_task(asyncio.to_thread(_load_conforto))
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/conforto/portal/auth")
async def portal_auth(request: Request):
    body = await request.json()
    pin = body.get("pin", "").strip()
    try:
        rows = await arun_query(
            f"SELECT nome FROM {S_CONFORTO}.portal_pins WHERE pin=? AND ativo=true LIMIT 1",
            [pin]
        )
        if rows:
            return JSONResponse({"ok": True, "nome": rows[0]["nome"]})
        return JSONResponse({"ok": False}, status_code=401)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/conforto/portal/atividades")
async def portal_atividades(request: Request):
    try:
        manutencoes = await arun_query(f"""
            SELECT id, uc_id, tipo, falha, status,
                   CAST(data_abertura AS STRING) AS data_abertura,
                   tecnicos, duracao_min, num_pessoas, pausas, obs
            FROM {S_CONFORTO}.manutencoes
            WHERE status IN ('Em Aberto', 'Em Andamento', 'Aguardando Peça')
            ORDER BY data_abertura DESC
        """)
        preventivas = await arun_query(f"""
            SELECT id, uc_id, status,
                   CAST(data_prevista AS STRING) AS data_prevista,
                   tecnicos
            FROM {S_CONFORTO}.preventivas
            WHERE status IN ('Pendente', 'Em Atraso')
            ORDER BY data_prevista ASC
        """)
        import json as _json
        return HTMLResponse(
            content=_json.dumps({
                "manutencoes": manutencoes or [],
                "preventivas": preventivas or []
            }, default=str),
            media_type="application/json"
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/conforto/preventivas/{pid}")
async def deletar_preventiva(pid: str, request: Request):
    try:
        await arun_exec(f"DELETE FROM {S_CONFORTO}.preventivas WHERE id=?", [pid])
        cache_invalidate("conforto")
        asyncio.create_task(asyncio.to_thread(_load_conforto))
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

app.mount("/", StaticFiles(directory=BASE, html=True), name="static")