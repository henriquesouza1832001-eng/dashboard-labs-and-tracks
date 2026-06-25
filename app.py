from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from databricks import sql
import os, json
import asyncio
import hashlib, jwt, datetime
JWT_SECRET = os.getenv("JWT_SECRET")


app = FastAPI()

HOST         = os.getenv("DATABRICKS_HOST", "")
TOKEN        = os.getenv("DATABRICKS_TOKEN", "")
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "d523a4cf58739a90")

_conn_cache = None

def get_conn():
    global _conn_cache
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

_cache = {}

def db_get(schema, table, chave):
    cache_key = f"{table}/{chave}"
    if cache_key in _cache:
        return _cache[cache_key]
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT dados_json FROM {schema}.{table} WHERE chave = ? LIMIT 1",
                    [chave]
                )
                row = cur.fetchone()
                if row:
                    dados = json.loads(row[0])
                    _cache[cache_key] = dados
                    return dados
    except Exception as e:
        print(f"db_get error: {e}")
    return None

def db_save(schema, table, chave, dados, usuario="sistema"):
    cache_key = f"{table}/{chave}"
    try:
        j = json.dumps(dados, ensure_ascii=False)
        with get_conn() as conn:
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
        _cache[cache_key] = dados
        return True
    except Exception as e:
        print(f"db_save error: {e}")
        return False

def get_usuario(request):
    return request.headers.get("X-Forwarded-User", "dev@local")

S_CHAMADOS   = "eng_lab.dashboard_labs_and_tracks_chamados"
S_OBRAS      = "eng_lab.dashboard_labs_and_tracks_obras"
S_CODIN      = "eng_lab.dashboard_labs_and_tracks_codin"
S_CONFORTO   = "eng_lab.dashboard_labs_and_tracks_conforto"
S_ATIVIDADES = "eng_lab.dashboard_labs_and_tracks_atividades"
S_HUB        = "eng_lab.dashboard_labs_and_tracks_hub"

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/chamados")
async def get_chamados():
    dados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal")
    return JSONResponse(dados if dados else {"chamados": []})

@app.post("/api/chamados")
async def save_chamados(request: Request):
    dados = await request.json()
    ok = db_save(S_CHAMADOS, "chamados_completo", "chamados_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/obras")
async def get_obras():
    dados = db_get(S_OBRAS, "obras_completo", "obras_principal")
    return JSONResponse(dados if dados else {"obras": [], "lancamentos": [], "budget": [], "revisoes": []})

@app.post("/api/obras")
async def save_obras(request: Request):
    dados = await request.json()
    ok = db_save(S_OBRAS, "obras_completo", "obras_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/codin")
async def get_codin():
    dados = db_get(S_CODIN, "codin_completo", "codin_principal")
    return JSONResponse(dados if dados else {"pessoas": [], "pontos": [], "acessos": [], "leitores": []})

@app.post("/api/codin")
async def save_codin(request: Request):
    dados = await request.json()
    ok = db_save(S_CODIN, "codin_completo", "codin_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/conforto")
async def get_conforto():
    dados = db_get(S_CONFORTO, "conforto_completo", "conforto_principal")
    return JSONResponse(dados if dados else {"areas": [], "ucs": [], "ordens": []})

@app.post("/api/conforto")
async def save_conforto(request: Request):
    dados = await request.json()
    ok = db_save(S_CONFORTO, "conforto_completo", "conforto_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/atividades")
async def get_atividades():
    dados = db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal")
    return JSONResponse(dados if dados else {"atividades": []})

@app.post("/api/atividades")
async def save_atividades(request: Request):
    dados = await request.json()
    ok = db_save(S_ATIVIDADES, "atividades_completo", "atividades_principal", dados, get_usuario(request))
    return JSONResponse({"ok": ok})

@app.get("/api/hub/config")
async def get_hub_config(request: Request):
    usuario = get_usuario(request)
    dados = db_get(S_HUB, "config", f"config_{usuario}")
    return JSONResponse(dados if dados else {})

@app.post("/api/hub/config")
async def save_hub_config(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    try:
        j = json.dumps(dados, ensure_ascii=False)
        with get_conn() as conn:
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
        print(f"hub config error: {e}")
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
            "criticos":   len([x for x in c if x.get("prioridade") == "Crítica" and x.get("status") not in ["Concluído","Cancelado"]]),
        },
        "obras": {
            "total":       len(o),
            "andamento":   len([x for x in o if x.get("status") == "Em Andamento"]),
            "concluidas":  len([x for x in o if x.get("status") == "Concluído"]),
            "gasto_total": sum(x.get("precoUnit", 0) * x.get("qtd", 1) for x in l),
        }
    })

@app.get("/api/kpi/dados")
async def get_kpi():
    return JSONResponse({
        "chamados":   db_get(S_CHAMADOS,   "chamados_completo",   "chamados_principal")   or {},
        "obras":      db_get(S_OBRAS,      "obras_completo",      "obras_principal")      or {},
        "atividades": db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal") or {},
        "conforto":   db_get(S_CONFORTO,   "conforto_completo",   "conforto_principal")   or {},
    })
@app.post("/api/auth/login")
async def login(request: Request):
    try:
        body = await request.json()
        email = body.get("email", "").strip().lower()
        senha = body.get("senha", "")
        if not email or not senha:
            return JSONResponse({"erro": "credenciais inválidas"}, status_code=401)
        with get_conn() as conn:
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
            "nome": nome,
            "email": db_email,
            "role": role,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        return JSONResponse({"token": token})
    except Exception as e:
        print(f"login error: {e}")
        return JSONResponse({"erro": "erro interno"}, status_code=500)
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

@app.on_event("startup")
async def prefetch():
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, lambda: db_get(S_CHAMADOS, "chamados_completo", "chamados_principal"))
    loop.run_in_executor(None, lambda: db_get(S_OBRAS, "obras_completo", "obras_principal"))
    loop.run_in_executor(None, lambda: db_get(S_CONFORTO, "conforto_completo", "conforto_principal"))
    loop.run_in_executor(None, lambda: db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal"))

app.mount("/", StaticFiles(directory="ERPFiat-Portatil/resources", html=True), name="static")

app.mount("/", StaticFiles(directory="ERPFiat-Portatil/resources", html=True), name="static")