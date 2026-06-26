from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from databricks import sql
import os, json, asyncio, hashlib, jwt, datetime, threading, time

# ─── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")

def verificar_admin(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if payload.get("role") == "admin":
                return payload
        except:
            pass
    email = request.headers.get("X-Forwarded-User", "").strip().lower()
    if not email:
        return None
    try:
        rows = run_query(
            "SELECT role FROM eng_lab.`dashboard-labs-and-tracks`.usuarios WHERE email=? AND ativo=true LIMIT 1",
            [email]
        )
        if rows and rows[0].get("role") == "admin":
            return {"email": email, "role": "admin"}
    except:
        pass
    return None

app = FastAPI()

# ─── Databricks connection ─────────────────────────────────────────────────────
HOST         = os.getenv("DATABRICKS_HOST", "")
TOKEN        = os.getenv("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "d523a4cf58739a90")

_conn      = None
_conn_lock = threading.Lock()

def get_conn():
    global _conn
    with _conn_lock:
        for _ in range(2):
            try:
                if _conn:
                    with _conn.cursor() as _c:
                        _c.execute("SELECT 1")
                    return _conn
            except:
                _conn = None
            try:
                _conn = sql.connect(
                    server_hostname=HOST,
                    http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
                    access_token=TOKEN,
                )
            except:
                pass
        return _conn

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

# ─── Schemas ───────────────────────────────────────────────────────────────────
S_CHAMADOS   = "eng_lab.dashboard_labs_and_tracks_chamados"
S_OBRAS      = "eng_lab.dashboard_labs_and_tracks_obras"
S_CODIN      = "eng_lab.dashboard_labs_and_tracks_codin"
S_CONFORTO   = "eng_lab.dashboard_labs_and_tracks_conforto"
S_ATIVIDADES = "eng_lab.dashboard_labs_and_tracks_atividades"
S_HUB        = "eng_lab.dashboard_labs_and_tracks_hub"

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

def _jloads(s):
    if not s:
        return []
    try:
        return json.loads(s)
    except:
        return []

def _jdumps(obj):
    return json.dumps(obj, ensure_ascii=False)

def _ts(v):
    if v and hasattr(v, "isoformat"):
        return v.isoformat()
    return v

def get_usuario(request):
    return request.headers.get("X-Forwarded-User", "dev@local")

# ─── Loaders ───────────────────────────────────────────────────────────────────
def _load_chamados():
    rows = run_query(f"SELECT * FROM {S_CHAMADOS}.chamados ORDER BY dataAbertura DESC")
    for r in rows:
        r["fotos"]     = _jloads(r.get("fotos"))
        r["historico"] = _jloads(r.get("historico"))
        for f in ("dataAbertura","dataConclusao","atualizado_em"):
            r[f] = _ts(r.get(f))
    payload = {"chamados": rows}
    cache_set("chamados", payload)
    return payload

def _load_obras():
    obras = run_query(f"SELECT * FROM {S_OBRAS}.obras")
    for o in obras:
        o["etapas"]       = _jloads(o.get("etapas"))
        o["atualizado_em"]= _ts(o.get("atualizado_em"))

    budget = run_query(f"SELECT * FROM {S_OBRAS}.budget")
    for b in budget:
        b["atualizado_em"] = _ts(b.get("atualizado_em"))

    lancs = run_query(f"SELECT * FROM {S_OBRAS}.lancamentos ORDER BY dtLanc DESC")
    for l in lancs:
        l["atualizado_em"] = _ts(l.get("atualizado_em"))

    payload = {"versao":"2.0","obras":obras,"budget":budget,"lancamentos":lancs,"revisoes":[]}
    cache_set("obras", payload)
    return payload

def _load_codin():
    pessoas = run_query(f"SELECT * FROM {S_CODIN}.pessoas")
    pontos  = run_query(f"SELECT * FROM {S_CODIN}.pontos")
    for p in pontos:
        p["leitores"] = _jloads(p.get("leitores"))
    for x in pessoas + pontos:
        x["atualizado_em"] = _ts(x.get("atualizado_em"))
    payload = {"pessoas":pessoas,"pontos":pontos,"acessos":[],"leitores":[]}
    cache_set("codin", payload)
    return payload

def _load_atividades():
    rows = run_query(f"SELECT * FROM {S_ATIVIDADES}.atividades ORDER BY criadoEm DESC")
    for r in rows:
        r["comentarios"]  = _jloads(r.get("comentarios"))
        r["atualizado_em"]= _ts(r.get("atualizado_em"))
    payload = {"versao":"2.0","atividades":rows}
    cache_set("atividades", payload)
    return payload

def _load_conforto():
    try:
        rows = run_query(f"SELECT chave, valor_json FROM {S_CONFORTO}.config")
        config = {}
        for r in rows:
            try:
                config[r["chave"]] = json.loads(r["valor_json"])
            except:
                config[r["chave"]] = r["valor_json"]
    except:
        config = {}
    payload = {
        "versao":"2.0","ordens":[],"ucs":[],"preventivas":[],
        "manutencoes":[],"pecas":[],"requisicoes":[],"areas":[],
        "fornecedores":[],"tecnicos":[],"rotinas":[],"config":config
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

# ─── Startup ───────────────────────────────────────────────────────────────────
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
    print("[startup] aquecendo cache em paralelo...")
    await asyncio.gather(*[loop.run_in_executor(None, fn) for fn in LOADERS.values()])
    print("[startup] cache aquecido.")
    threading.Thread(target=_background_refresh, args=(300,), daemon=True).start()

# ─── HTML injection ────────────────────────────────────────────────────────────
def inject(html_path, dados):
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()
    script = f'<script>window.__DADOS__={json.dumps(dados, ensure_ascii=False, default=str)};</script>'
    return HTMLResponse(html.replace("</body>", f"{script}\n</body>"))

# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    with _cache_lock:
        keys = list(_cache.keys())
    return {"status": "ok", "cache": keys}

# ─── Chamados ─────────────────────────────────────────────────────────────────
@app.get("/api/chamados")
async def get_chamados():
    return JSONResponse(get_cached("chamados"))

@app.post("/api/chamados")
async def create_chamado(request: Request):
    body = await request.json()
    u = get_usuario(request)
    run_exec(f"""
        INSERT INTO {S_CHAMADOS}.chamados
            (id,titulo,categoria,tipo,prioridade,local,setor,solicitante,
             dataDesejada,descricao,status,responsavel,idExterno,
             dataAbertura,dataConclusao,fotos,historico,atualizado_por)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, [
        body["id"],body.get("titulo"),body.get("categoria"),body.get("tipo"),
        body.get("prioridade"),body.get("local"),body.get("setor"),
        body.get("solicitante"),body.get("dataDesejada"),body.get("descricao"),
        body.get("status","Aberto"),body.get("responsavel"),body.get("idExterno"),
        body.get("dataAbertura"),body.get("dataConclusao"),
        _jdumps(body.get("fotos",[])),_jdumps(body.get("historico",[])),u
    ])
    cache_invalidate("chamados")
    return JSONResponse({"ok": True})

@app.put("/api/chamados/{cid}")
async def update_chamado(cid: str, request: Request):
    body = await request.json()
    u = get_usuario(request)
    run_exec(f"""
        MERGE INTO {S_CHAMADOS}.chamados AS t
        USING (SELECT ? AS id) AS s ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET
            titulo=?,categoria=?,tipo=?,prioridade=?,local=?,setor=?,
            solicitante=?,dataDesejada=?,descricao=?,status=?,responsavel=?,
            idExterno=?,dataAbertura=?,dataConclusao=?,
            fotos=?,historico=?,atualizado_em=current_timestamp(),atualizado_por=?
    """, [
        cid,
        body.get("titulo"),body.get("categoria"),body.get("tipo"),
        body.get("prioridade"),body.get("local"),body.get("setor"),
        body.get("solicitante"),body.get("dataDesejada"),body.get("descricao"),
        body.get("status"),body.get("responsavel"),body.get("idExterno"),
        body.get("dataAbertura"),body.get("dataConclusao"),
        _jdumps(body.get("fotos",[])),_jdumps(body.get("historico",[])),u
    ])
    cache_invalidate("chamados")
    return JSONResponse({"ok": True})

@app.delete("/api/chamados/{cid}")
async def delete_chamado(cid: str, request: Request):
    run_exec(f"DELETE FROM {S_CHAMADOS}.chamados WHERE id = ?", [cid])
    cache_invalidate("chamados")
    return JSONResponse({"ok": True})

@app.get("/api/chamados/sla")
async def get_sla():
    v = cache_get("sla")
    if v:
        return JSONResponse(v)
    try:
        rows = run_query(f"SELECT dados_json FROM {S_HUB}.config WHERE chave='sla_global' LIMIT 1")
        if rows:
            cfg = json.loads(rows[0]["dados_json"])
            cache_set("sla", cfg)
            return JSONResponse(cfg)
    except:
        pass
    return JSONResponse({"Critica":1,"Alta":3,"Media":5,"Baixa":7})

@app.post("/api/chamados/sla")
async def save_sla(request: Request):
    cfg = await request.json()
    u = get_usuario(request)
    run_exec(f"""
        MERGE INTO {S_HUB}.config AS t
        USING (SELECT 'sla_global' AS chave) AS s ON t.chave = s.chave
        WHEN MATCHED THEN UPDATE SET dados_json=?,atualizado_por=?,atualizado_em=current_timestamp()
        WHEN NOT MATCHED THEN INSERT (chave,dados_json,atualizado_por,atualizado_em)
            VALUES ('sla_global',?,?,current_timestamp())
    """, [_jdumps(cfg),u,_jdumps(cfg),u])
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
    for o in body.get("obras", []):
        run_exec(f"""
            MERGE INTO {S_OBRAS}.obras AS t
            USING (SELECT ? AS cod) AS s ON t.cod = s.cod
            WHEN MATCHED THEN UPDATE SET
                nome=?,tipo=?,local=?,responsavel=?,respNome=?,cresp=?,status=?,
                dtInicioPrev=?,dtFimPrev=?,dtInicioReal=?,dtFimReal=?,obs=?,etapas=?,
                atualizado_em=current_timestamp(),atualizado_por=?
            WHEN NOT MATCHED THEN INSERT
                (cod,nome,tipo,local,responsavel,respNome,cresp,status,
                 dtInicioPrev,dtFimPrev,dtInicioReal,dtFimReal,obs,etapas,atualizado_por)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            o["cod"],
            o.get("nome"),o.get("tipo"),o.get("local"),o.get("responsavel"),
            o.get("respNome"),o.get("cresp"),o.get("status"),
            o.get("dtInicioPrev"),o.get("dtFimPrev"),o.get("dtInicioReal"),o.get("dtFimReal"),
            o.get("obs"),_jdumps(o.get("etapas",[])),u,
            o["cod"],o.get("nome"),o.get("tipo"),o.get("local"),o.get("responsavel"),
            o.get("respNome"),o.get("cresp"),o.get("status"),
            o.get("dtInicioPrev"),o.get("dtFimPrev"),o.get("dtInicioReal"),o.get("dtFimReal"),
            o.get("obs"),_jdumps(o.get("etapas",[])),u
        ])
    for l in body.get("lancamentos", []):
        run_exec(f"""
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
            l["id"],
            l.get("obraCod"),l.get("cresp"),l.get("categoria"),l.get("subcategoria"),
            l.get("descricao"),l.get("unid"),l.get("qtd"),l.get("precoUnit"),
            l.get("nfDoc"),l.get("dtLanc"),l.get("fornecedor"),l.get("obs"),u,
            l["id"],l.get("obraCod"),l.get("cresp"),l.get("categoria"),l.get("subcategoria"),
            l.get("descricao"),l.get("unid"),l.get("qtd"),l.get("precoUnit"),
            l.get("nfDoc"),l.get("dtLanc"),l.get("fornecedor"),l.get("obs"),u
        ])
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
    for p in body.get("pessoas", []):
        run_exec(f"""
            MERGE INTO {S_CODIN}.pessoas AS t
            USING (SELECT ? AS id) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                nome=?,cargo=?,setor=?,status=?,lib=?,obs=?,
                atualizado_em=current_timestamp(),atualizado_por=?
            WHEN NOT MATCHED THEN INSERT (id,nome,cargo,setor,status,lib,obs,atualizado_por)
                VALUES (?,?,?,?,?,?,?,?)
        """, [
            p["id"],p.get("nome"),p.get("cargo"),p.get("setor"),
            p.get("status"),p.get("lib"),p.get("obs"),u,
            p["id"],p.get("nome"),p.get("cargo"),p.get("setor"),
            p.get("status"),p.get("lib"),p.get("obs"),u
        ])
    cache_invalidate("codin")
    return JSONResponse({"ok": True})

# ─── Conforto ─────────────────────────────────────────────────────────────────
@app.get("/api/conforto")
async def get_conforto():
    return JSONResponse(get_cached("conforto"))

@app.post("/api/conforto")
async def save_conforto(request: Request):
    body = await request.json()
    u = get_usuario(request)
    if "config" in body:
        try:
            await arun_exec(f"""
                MERGE INTO {S_CONFORTO}.config AS t
                USING (SELECT 'config_geral' AS chave) AS s ON t.chave = s.chave
                WHEN MATCHED THEN UPDATE SET valor_json=?,atualizado_por=?,atualizado_em=current_timestamp()
                WHEN NOT MATCHED THEN INSERT (chave,valor_json,atualizado_por)
                    VALUES ('config_geral',?,?)
            """, [_jdumps(body["config"]),u,_jdumps(body["config"]),u])
        except Exception as e:
            print(f"[conforto] erro ao salvar: {e}")
            return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("conforto")
    return JSONResponse({"ok": True})

# ─── Atividades ───────────────────────────────────────────────────────────────
@app.get("/api/atividades")
async def get_atividades():
    return JSONResponse(get_cached("atividades"))

@app.post("/api/atividades")
async def save_atividades(request: Request):
    body = await request.json()
    u = get_usuario(request)
    for a in body.get("atividades", []):
        run_exec(f"""
            MERGE INTO {S_ATIVIDADES}.atividades AS t
            USING (SELECT ? AS id) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                titulo=?,desc=?,status=?,prioridade=?,responsavel=?,obra=?,
                prazo=?,progresso=?,tags=?,criadoPor=?,criadoEm=?,comentarios=?,
                atualizado_em=current_timestamp(),atualizado_por=?
            WHEN NOT MATCHED THEN INSERT
                (id,titulo,desc,status,prioridade,responsavel,obra,
                 prazo,progresso,tags,criadoPor,criadoEm,comentarios,atualizado_por)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            a["id"],
            a.get("titulo"),a.get("desc"),a.get("status"),a.get("prioridade"),
            a.get("responsavel"),a.get("obra"),a.get("prazo"),a.get("progresso",0),
            a.get("tags"),a.get("criadoPor"),a.get("criadoEm"),
            _jdumps(a.get("comentarios",[])),u,
            a["id"],
            a.get("titulo"),a.get("desc"),a.get("status"),a.get("prioridade"),
            a.get("responsavel"),a.get("obra"),a.get("prazo"),a.get("progresso",0),
            a.get("tags"),a.get("criadoPor"),a.get("criadoEm"),
            _jdumps(a.get("comentarios",[])),u
        ])
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
        rows = run_query(f"SELECT dados_json FROM {S_HUB}.config WHERE chave=? LIMIT 1", [f"config_{usuario}"])
        dados = json.loads(rows[0]["dados_json"]) if rows else {}
    except:
        dados = {}
    cache_set(key, dados)
    return JSONResponse(dados)

@app.post("/api/hub/config")
async def save_hub_config(request: Request):
    dados   = await request.json()
    usuario = get_usuario(request)
    run_exec(f"""
        MERGE INTO {S_HUB}.config AS t
        USING (SELECT ? AS chave) AS s ON t.chave = s.chave
        WHEN MATCHED THEN UPDATE SET dados_json=?,atualizado_por=?,atualizado_em=current_timestamp()
        WHEN NOT MATCHED THEN INSERT (chave,dados_json,atualizado_por,atualizado_em)
            VALUES (?,?,?,current_timestamp())
    """, [f"config_{usuario}",_jdumps(dados),usuario,f"config_{usuario}",_jdumps(dados),usuario])
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
            "abertos":    len([x for x in c if x.get("status")=="Aberto"]),
            "andamento":  len([x for x in c if x.get("status")=="Em Andamento"]),
            "concluidos": len([x for x in c if x.get("status")=="Concluido"]),
            "criticos":   len([x for x in c if x.get("prioridade")=="Critica"
                               and x.get("status") not in ["Concluido","Cancelado"]]),
        },
        "obras": {
            "total":       len(o),
            "andamento":   len([x for x in o if x.get("status")=="Em Andamento"]),
            "concluidas":  len([x for x in o if x.get("status")=="Concluido"]),
            "gasto_total": sum(x.get("precoUnit",0)*x.get("qtd",1) for x in l),
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

# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(request: Request):
    try:
        body  = await request.json()
        email = body.get("email","").strip().lower()
        senha = body.get("senha","")
        if not email or not senha:
            return JSONResponse({"erro":"credenciais invalidas"}, status_code=401)
        rows = run_query(
            "SELECT nome,email,senha_hash,role,ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios WHERE email=? LIMIT 1",
            [email]
        )
        if not rows:
            return JSONResponse({"erro":"credenciais invalidas"}, status_code=401)
        r = rows[0]
        if not r["ativo"]:
            return JSONResponse({"erro":"usuario inativo"}, status_code=403)
        if hashlib.sha256(senha.encode()).hexdigest() != r["senha_hash"]:
            return JSONResponse({"erro":"credenciais invalidas"}, status_code=401)
        token = jwt.encode({
            "nome":r["nome"],"email":r["email"],"role":r["role"],
            "exp":datetime.datetime.utcnow()+datetime.timedelta(hours=12)
        }, JWT_SECRET, algorithm="HS256")
        return JSONResponse({"token": token})
    except Exception as e:
        print(f"[login] erro: {e}")
        return JSONResponse({"erro":"erro interno"}, status_code=500)

# ─── Admin ────────────────────────────────────────────────────────────────────
@app.get("/api/admin/usuarios")
async def admin_listar(request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro":"sem permissao"}, status_code=403)
    return JSONResponse(run_query("SELECT id,nome,email,role,ativo FROM eng_lab.`dashboard-labs-and-tracks`.usuarios ORDER BY id"))

@app.post("/api/admin/usuarios")
async def admin_criar(request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro":"sem permissao"}, status_code=403)
    body = await request.json()
    run_exec(
        "INSERT INTO eng_lab.`dashboard-labs-and-tracks`.usuarios (nome,email,senha_hash,role,ativo) VALUES (?,?,?,?,true)",
        [body["nome"],body["email"].lower(),hashlib.sha256(body["senha"].encode()).hexdigest(),body.get("role","visualizador")]
    )
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}")
async def admin_toggle(uid: int, request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro":"sem permissao"}, status_code=403)
    body = await request.json()
    run_exec("UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET ativo=? WHERE id=?", [body["ativo"],uid])
    return JSONResponse({"ok": True})

@app.put("/api/admin/usuarios/{uid}/senha")
async def admin_reset_senha(uid: int, request: Request):
    if not verificar_admin(request):
        return JSONResponse({"erro":"sem permissao"}, status_code=403)
    body = await request.json()
    run_exec("UPDATE eng_lab.`dashboard-labs-and-tracks`.usuarios SET senha_hash=? WHERE id=?",
             [hashlib.sha256(body["senha"].encode()).hexdigest(),uid])
    return JSONResponse({"ok": True})

async def arun_query(sql_str, params=None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_query, sql_str, params)

async def arun_exec(sql_str, params=None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, run_exec, sql_str, params)

def run_exec(sql_str, params=None):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql_str, params or [])

# ─── Paginas HTML com dados injetados ─────────────────────────────────────────
BASE = "ERPFiat-Portatil/resources"

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
    return inject(f"{BASE}/obras/obras.html", get_cached("obras"))

@app.get("/codin")
async def codin_page():
    return inject(f"{BASE}/codins/codin.html", get_cached("codin"))

@app.get("/conforto")
async def conforto_page():
    return inject(f"{BASE}/conforto/conforto.html", get_cached("conforto"))

@app.get("/atividades")
async def atividades_page():
    return inject(f"{BASE}/atividades/atividades.html", get_cached("atividades"))

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

app.mount("/", StaticFiles(directory=BASE, html=True), name="static")