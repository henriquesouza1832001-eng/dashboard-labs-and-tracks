from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from databricks import sql
import os, json

app = FastAPI()

# ── Conexão Delta Lake ─────────────────────────────────
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "")
HOST         = os.getenv("DATABRICKS_HOST", "")
TOKEN        = os.getenv("DATABRICKS_TOKEN", "")

def get_conn():
    return sql.connect(
        server_hostname = HOST,
        http_path       = f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
        access_token    = TOKEN,
    )

def db_get(schema: str, table: str, chave: str):
    """Lê dados_json de uma linha pelo chave."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT dados_json FROM {schema}.{table} WHERE chave = ? LIMIT 1",
                    [chave]
                )
                row = cur.fetchone()
                if row:
                    return json.loads(row[0])
    except Exception as e:
        print(f"db_get error: {e}")
    return None

def db_save(schema: str, table: str, chave: str, dados: dict, usuario: str = "sistema"):
    """Salva (MERGE) dados_json pelo chave."""
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
        return True
    except Exception as e:
        print(f"db_save error: {e}")
        return False

def get_usuario(request: Request) -> str:
    return request.headers.get("X-Forwarded-User", "dev@local")

# Schemas
S_CHAMADOS   = "eng_lab.dashboard_labs_and_tracks_chamados"
S_OBRAS      = "eng_lab.dashboard_labs_and_tracks_obras"
S_CODIN      = "eng_lab.dashboard_labs_and_tracks_codin"
S_CONFORTO   = "eng_lab.dashboard_labs_and_tracks_conforto"
S_ATIVIDADES = "eng_lab.dashboard_labs_and_tracks_atividades"
S_HUB        = "eng_lab.dashboard_labs_and_tracks_hub"

# ── HEALTH ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}

# ── CHAMADOS ───────────────────────────────────────────
@app.get("/api/chamados")
async def get_chamados():
    dados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal")
    if dados:
        return JSONResponse(dados)
    return JSONResponse({"chamados": []})

@app.post("/api/chamados")
async def save_chamados(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    ok = db_save(S_CHAMADOS, "chamados_completo", "chamados_principal", dados, usuario)
    return JSONResponse({"ok": ok})

# ── OBRAS ──────────────────────────────────────────────
@app.get("/api/obras")
async def get_obras():
    dados = db_get(S_OBRAS, "obras_completo", "obras_principal")
    if dados:
        return JSONResponse(dados)
    return JSONResponse({"obras": [], "lancamentos": [], "budget": [], "revisoes": []})

@app.post("/api/obras")
async def save_obras(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    ok = db_save(S_OBRAS, "obras_completo", "obras_principal", dados, usuario)
    return JSONResponse({"ok": ok})

# ── CODIN ──────────────────────────────────────────────
@app.get("/api/codin")
async def get_codin():
    dados = db_get(S_CODIN, "codin_completo", "codin_principal")
    if dados:
        return JSONResponse(dados)
    return JSONResponse({"pessoas": [], "pontos": [], "acessos": [], "leitores": []})

@app.post("/api/codin")
async def save_codin(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    ok = db_save(S_CODIN, "codin_completo", "codin_principal", dados, usuario)
    return JSONResponse({"ok": ok})

# ── CONFORTO ───────────────────────────────────────────
@app.get("/api/conforto")
async def get_conforto():
    dados = db_get(S_CONFORTO, "conforto_completo", "conforto_principal")
    if dados:
        return JSONResponse(dados)
    return JSONResponse({"areas": [], "ucs": [], "ordens": []})

@app.post("/api/conforto")
async def save_conforto(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    ok = db_save(S_CONFORTO, "conforto_completo", "conforto_principal", dados, usuario)
    return JSONResponse({"ok": ok})

# ── ATIVIDADES ─────────────────────────────────────────
@app.get("/api/atividades")
async def get_atividades():
    dados = db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal")
    if dados:
        return JSONResponse(dados)
    return JSONResponse({"atividades": []})

@app.post("/api/atividades")
async def save_atividades(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    ok = db_save(S_ATIVIDADES, "atividades_completo", "atividades_principal", dados, usuario)
    return JSONResponse({"ok": ok})

# ── HUB CONFIG ─────────────────────────────────────────
@app.get("/api/hub/config")
async def get_hub_config(request: Request):
    usuario = get_usuario(request)
    chave = f"config_{usuario}"
    dados = db_get(S_HUB, "config", chave)
    if dados:
        return JSONResponse(dados)
    return JSONResponse({})

@app.post("/api/hub/config")
async def save_hub_config(request: Request):
    dados = await request.json()
    usuario = get_usuario(request)
    chave = f"config_{usuario}"
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

# ── HUB DADOS (KPIs consolidados) ──────────────────────
@app.get("/api/hub/dados")
async def get_hub_dados():
    chamados = db_get(S_CHAMADOS, "chamados_completo", "chamados_principal") or {"chamados": []}
    obras    = db_get(S_OBRAS,    "obras_completo",    "obras_principal")    or {"obras": [], "lancamentos": []}
    c = chamados.get("chamados", [])
    o = obras.get("obras", [])
    l = obras.get("lancamentos", [])
    return JSONResponse({
        "chamados": {
            "total":     len(c),
            "abertos":   len([x for x in c if x.get("status") == "Aberto"]),
            "andamento": len([x for x in c if x.get("status") == "Em Andamento"]),
            "concluidos":len([x for x in c if x.get("status") == "Concluído"]),
            "criticos":  len([x for x in c if x.get("prioridade") == "Crítica" and x.get("status") not in ["Concluído","Cancelado"]]),
        },
        "obras": {
            "total":      len(o),
            "andamento":  len([x for x in o if x.get("status") == "Em Andamento"]),
            "concluidas": len([x for x in o if x.get("status") == "Concluído"]),
            "gasto_total": sum(x.get("precoUnit", 0) * x.get("qtd", 1) for x in l),
        }
    })

# ── KPI DADOS (todos os módulos) ───────────────────────
@app.get("/api/kpi/dados")
async def get_kpi():
    chamados   = db_get(S_CHAMADOS,   "chamados_completo",   "chamados_principal")   or {}
    obras      = db_get(S_OBRAS,      "obras_completo",      "obras_principal")      or {}
    atividades = db_get(S_ATIVIDADES, "atividades_completo", "atividades_principal") or {}
    conforto   = db_get(S_CONFORTO,   "conforto_completo",   "conforto_principal")   or {}
    return JSONResponse({
        "chamados":   chamados,
        "obras":      obras,
        "atividades": atividades,
        "conforto":   conforto,
    })

# ── STATIC (deve ser o último) ─────────────────────────
@app.get("/")
async def root():
    return FileResponse("ERPFiat-Portatil/resources/hub/hub.html")

app.mount("/", StaticFiles(directory="ERPFiat-Portatil/resources", html=True), name="static")