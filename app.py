from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, RedirectResponse
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

async def arun_exec_retry(sql_str, params=None, tentativas=3):
    for i in range(tentativas):
        try:
            return await arun_exec(sql_str, params)
        except Exception as e:
            if "DELTA_CONCURRENT_APPEND" in str(e) or "ConcurrentAppendException" in str(e):
                if i < tentativas - 1:
                    print(f"[retry] conflito Delta detectado, tentativa {i+1}/{tentativas}...")
                    await asyncio.sleep(0.5 * (i + 1))
                    continue
            raise

async def arun_exec_retry(sql_str, params=None, tentativas=3):
    for i in range(tentativas):
        try:
            return await arun_exec(sql_str, params)
        except Exception as e:
            if "DELTA_CONCURRENT_APPEND" in str(e) or "ConcurrentAppendException" in str(e):
                if i < tentativas - 1:
                    print(f"[retry] conflito Delta detectado, tentativa {i+1}/{tentativas}...")
                    await asyncio.sleep(0.5 * (i + 1))
                    continue
            raise

async def arun_exec_retry(sql_str, params=None, tentativas=3):
    for i in range(tentativas):
        try:
            return await arun_exec(sql_str, params)
        except Exception as e:
            if "DELTA_CONCURRENT_APPEND" in str(e) or "ConcurrentAppendException" in str(e):
                if i < tentativas - 1:
                    print(f"[retry] conflito Delta detectado, tentativa {i+1}/{tentativas}...")
                    await asyncio.sleep(0.5 * (i + 1))
                    continue
            raise

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

def usuario_autenticado(request: Request):
    token = request.cookies.get("ctrl-token") or request.headers.get("X-Ctrl-Token", "")
    if not token:
        return None
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

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
    etapas_todas   = run_query(f"SELECT * FROM {S_OBRAS}.etapas ORDER BY ordem ASC")
    subtarefas_todas = run_query(f"SELECT * FROM {S_OBRAS}.etapa_subtarefas ORDER BY ordem ASC")
    sub_map = {}
    for s in subtarefas_todas:
        s["dtInicio"]     = str(s.pop("dt_inicio", None) or "")
        s["dtFim"]        = str(s.pop("dt_fim", None) or "")
        s["dtInicioReal"] = str(s.pop("dt_inicio_real", None) or "")
        s["dtFimReal"]    = str(s.pop("dt_fim_real", None) or "")
        s["atualizado_em"] = _ts(s.get("atualizado_em"))
        try:
            s["itens"] = json.loads(s.get("itens") or "[]")
        except Exception:
            s["itens"] = []
        sub_map.setdefault(s["etapa_id"], []).append(s)
    etapas_map = {}
    for e in etapas_todas:
        e["dtInicio"]     = str(e.pop("dt_inicio", None) or "")
        e["dtFim"]        = str(e.pop("dt_fim", None) or "")
        e["dtInicioReal"] = str(e.pop("dt_inicio_real", None) or "")
        e["dtFimReal"]    = str(e.pop("dt_fim_real", None) or "")
        e["orcamento"]    = e.get("orcamento") or 0
        if "atualizado_em" in e:
            e["atualizado_em"] = _ts(e.get("atualizado_em"))
        e["subtarefas"]   = sub_map.get(e["id"], [])
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
    avancos = run_query(f"SELECT * FROM {S_OBRAS}.etapas_avancos ORDER BY registrado_em ASC")
    for a in avancos:
        a["registrado_em"] = _ts(a.get("registrado_em"))
    payload = {"versao": "2.0", "obras": obras, "budget": budget, "lancamentos": lancs, "avancos": avancos, "revisoes": []}
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

    prev_rows = run_query(f"SELECT * FROM {S_CONFORTO}.preventivas ORDER BY data_prevista DESC")
    prev_checklist = run_query(f"SELECT preventiva_id, item, concluido, ordem FROM {S_CONFORTO}.preventiva_checklist ORDER BY ordem")
    prev_tecnicos  = run_query(f"SELECT preventiva_id, nome_tecnico FROM {S_CONFORTO}.preventiva_tecnicos")
    prev_cl_map  = {}
    for c in prev_checklist:
        prev_cl_map.setdefault(c["preventiva_id"], []).append({"item": c["item"], "concluido": bool(c["concluido"])})
    prev_tec_map = {}
    for t in prev_tecnicos:
        prev_tec_map.setdefault(t["preventiva_id"], []).append(t["nome_tecnico"])
    preventivas = []
    for p in prev_rows:
        preventivas.append({
            "id":            p.get("id"),
            "ucId":          p.get("uc_id"),
            "tecnicoId":     p.get("tecnico_id"),
            "dataPrevista":  str(p.get("data_prevista") or ""),
            "dataRealizada": str(p.get("data_realizada") or ""),
            "status":        p.get("status"),
            "checklist":     prev_cl_map.get(p["id"], []),
            "obs":           p.get("obs") or "",
            "origem":        p.get("origem") or "manual",
            "inicioEm":      _ts(p.get("inicio_em")) or "",
            "fimEm":         _ts(p.get("fim_em")) or "",
            "duracaoMin":    p.get("duracao_min"),
            "numPessoas":    p.get("num_pessoas"),
            "tecnicos":      prev_tec_map.get(p["id"], []),
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

    man_rows    = run_query(f"SELECT * FROM {S_CONFORTO}.manutencoes ORDER BY data_abertura DESC")
    man_sessoes = run_query(f"SELECT manutencao_id, tipo_sessao, inicio_em, fim_em, duracao_min, motivo_pausa FROM {S_CONFORTO}.manutencao_sessoes ORDER BY inicio_em")
    man_tecs    = run_query(f"SELECT manutencao_id, nome_tecnico FROM {S_CONFORTO}.manutencao_tecnicos")
    man_pecas   = run_query(f"SELECT manutencao_id, peca_id, nome_peca, quantidade FROM {S_CONFORTO}.manutencao_pecas")
    man_ses_map = {}
    for s in man_sessoes:
        man_ses_map.setdefault(s["manutencao_id"], []).append({
            "tipoSessao": s["tipo_sessao"],
            "inicioEm":   _ts(s.get("inicio_em")) or "",
            "fimEm":      _ts(s.get("fim_em")) or "",
            "duracaoMin": s.get("duracao_min"),
            "motivoPausa":s.get("motivo_pausa") or "",
        })
    man_tec_map = {}
    for t in man_tecs:
        man_tec_map.setdefault(t["manutencao_id"], []).append(t["nome_tecnico"])
    man_pec_map = {}
    for p in man_pecas:
        man_pec_map.setdefault(p["manutencao_id"], []).append({
            "pecaId": p.get("peca_id"), "nome": p.get("nome_peca"), "quantidade": p.get("quantidade")
        })
    manutencoes = []
    for m in man_rows:
        sessoes = man_ses_map.get(m["id"], [])
        duracao_total = sum(s["duracaoMin"] or 0 for s in sessoes if s["tipoSessao"] == "trabalho")
        num_pessoas   = len(man_tec_map.get(m["id"], [])) or m.get("num_pessoas") or 1
        manutencoes.append({
            "id":             m.get("id"),
            "ucId":           m.get("uc_id"),
            "tecnicoId":      m.get("tecnico_id"),
            "tipo":           m.get("tipo") or "Manutenção",
            "falha":          m.get("falha") or "",
            "dataAbertura":   str(m.get("data_abertura") or ""),
            "dataFechamento": str(m.get("data_fechamento") or ""),
            "status":         m.get("status"),
            "custoEstimado":  m.get("custo_estimado", 0),
            "obs":            m.get("obs") or "",
            "origem":         m.get("origem") or "manual",
            "fotoUrl":        m.get("foto_url") or "",
            "tecnicos":       man_tec_map.get(m["id"], []),
            "sessoes":        sessoes,
            "pecas":          man_pec_map.get(m["id"], []),
            "duracaoMin":     duracao_total,
            "numPessoas":     num_pessoas,
            "hhTotal":        round(duracao_total / 60 * num_pessoas, 2),
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

    rot_rows = run_query(f"SELECT * FROM {S_CONFORTO}.rotinas ORDER BY nome")
    rot_dias = run_query(f"SELECT rotina_id, dia_semana FROM {S_CONFORTO}.rotina_dias")
    rot_dias_map = {}
    for d in rot_dias:
        rot_dias_map.setdefault(d["rotina_id"], []).append(d["dia_semana"])
    rotinas = []
    for r in rot_rows:
        rotinas.append({
            "id":            r.get("id"),
            "nome":          r.get("nome"),
            "tipo":          r.get("tipo"),
            "areaId":        r.get("area_id"),
            "responsavelId": r.get("responsavel_id"),
            "frequencia":    r.get("frequencia"),
            "diasSemana":    rot_dias_map.get(r["id"], []),
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
    try:
        await arun_exec(f"""
            CREATE TABLE IF NOT EXISTS {S_OBRAS}.etapas_avancos (
                id STRING, etapa_id STRING, obra_cod STRING,
                avanco_fisico DOUBLE, registrado_em TIMESTAMP, registrado_por STRING
            )
        """)
    except Exception as e:
        print(f"[startup] etapas_avancos: {e}")
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
        resp = JSONResponse({"token": token})
        resp.set_cookie(
            key="ctrl-token", value=token,
            httponly=True, secure=True, samesite="lax",
            max_age=12 * 3600, path="/"
        )
        return resp
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
            await arun_exec(f"DELETE FROM {S_OBRAS}.etapa_subtarefas WHERE obra_cod=?", [o["cod"]])
            for i, e in enumerate(o.get("etapas", [])):
                eid = e.get("id") or f"{o['cod']}_e_{i}"
                await arun_exec(f"""
                    INSERT INTO {S_OBRAS}.etapas
                        (id,obra_cod,nome,dt_inicio,dt_fim,dt_inicio_real,dt_fim_real,
                         responsavel,peso,avanco_fisico,orcamento,ordem,obs,atualizado_por)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, [eid, o["cod"], e.get("nome"),
                      to_date_or_none(e.get("dtInicio")), to_date_or_none(e.get("dtFim")),
                      to_date_or_none(e.get("dtInicioReal")), to_date_or_none(e.get("dtFimReal")),
                      e.get("responsavel"), e.get("peso",1), e.get("avancoFisico",0),
                      e.get("orcamento",0), i, e.get("obs"), u])
                for j, s in enumerate(e.get("subtarefas", [])):
                    sid = s.get("id") or f"{eid}_s_{j}"
                    itens = s.get("itens", []) or []
                    total_itens = len(itens)
                    concl_itens = sum(1 for it in itens if it.get("concluido"))
                    af_calc = round(concl_itens/total_itens*100) if total_itens else s.get("avancoFisico", 0)
                    status_calc = s.get("status", "Pendente")
                    dt_fim_real = s.get("dtFimReal")
                    if status_calc != "Bloqueada":
                        if total_itens and concl_itens == total_itens:
                            status_calc = "Concluída"
                            dt_fim_real = dt_fim_real or str(datetime.date.today())
                        elif total_itens and concl_itens > 0:
                            status_calc = "Em Andamento"
                        elif total_itens:
                            status_calc = "Pendente"
                    await arun_exec(f"""
                        INSERT INTO {S_OBRAS}.etapa_subtarefas
                            (id,etapa_id,obra_cod,nome,responsavel,dt_inicio,dt_fim,
                             dt_inicio_real,dt_fim_real,orcamento,peso,avanco_fisico,
                             status,itens,obs,ordem,atualizado_por,atualizado_em)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,current_timestamp())
                    """, [sid, eid, o["cod"], s.get("nome"), s.get("responsavel"),
                          to_date_or_none(s.get("dtInicio")), to_date_or_none(s.get("dtFim")),
                          to_date_or_none(s.get("dtInicioReal")), to_date_or_none(dt_fim_real),
                          s.get("orcamento",0), s.get("peso",1), af_calc,
                          status_calc, json.dumps(itens), s.get("obs"), j, u])

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

@app.delete("/api/obras/{cod}/etapas/{etapa_id}")
async def deletar_etapa(cod: str, etapa_id: str):
    try:
        await arun_exec(f"DELETE FROM {S_OBRAS}.etapas WHERE obra_cod=? AND id=?", [cod, etapa_id])
        await arun_exec(f"DELETE FROM {S_OBRAS}.etapa_subtarefas WHERE etapa_id=?", [etapa_id])
        await arun_exec(f"DELETE FROM {S_OBRAS}.etapas_avancos WHERE etapa_id=?", [etapa_id])
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _load_obras)
        return JSONResponse({"ok": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

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


@app.post("/api/obras/{cod}/etapas/{etapa_id}/avanco")
async def registrar_avanco(cod: str, etapa_id: str, request: Request):
    u = getattr(request.state, "usuario", "sistema")
    body = await request.json()
    avanco = float(body.get("avancoFisico", 0))
    aid = str(datetime.datetime.utcnow().timestamp()).replace(".","")
    ts = datetime.datetime.utcnow().isoformat()
    try:
        subtarefa_id    = body.get("subtarefaId")
        avanco_fin      = float(body.get("avancoFinanceiro", 0))
        obs_avanco      = body.get("obs", "")
        await arun_exec(f"""
            INSERT INTO {S_OBRAS}.etapas_avancos
                (id, etapa_id, obra_cod, subtarefa_id, avanco_fisico,
                 avanco_financeiro, obs, registrado_em, registrado_por)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, [aid, etapa_id, cod, subtarefa_id, avanco, avanco_fin, obs_avanco, ts, u])
        await arun_exec(f"""
            MERGE INTO {S_OBRAS}.etapas AS t
            USING (SELECT '{cod}' AS obra_cod, '{body.get("nomeEtapa","")}' AS nome_etapa) AS s
            ON t.obra_cod = s.obra_cod AND t.nome = s.nome_etapa
            WHEN MATCHED THEN UPDATE SET avanco_fisico = {avanco}
        """)
    except Exception as e:
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("obras")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_obras)
    return JSONResponse({"ok": True})

@app.get("/api/obras/{cod}/avancos")
async def get_avancos_obra(cod: str):
    try:
        rows = await arun_query(f"""
            SELECT * FROM {S_OBRAS}.etapas_avancos WHERE obra_cod=? ORDER BY registrado_em ASC
        """, [cod])
        for r in rows:
            r["registrado_em"] = _ts(r.get("registrado_em"))
        return JSONResponse({"avancos": rows})
    except Exception as e:
        return JSONResponse({"avancos": []})

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
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.ucs WHERE id NOT IN ({placeholders}) AND atualizado_por != 'import'",
            ids_front
        )
    else:
        await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.ucs WHERE atualizado_por != 'import'")
    ucs = body.get("ucs", [])
    if ucs:
        selects = []
        params = []
        for uc in ucs:
            selects.append("SELECT ? AS id, ? AS codigo, ? AS nome, ? AS categoria, ? AS local, ? AS modelo, "
                           "? AS capacidade_btu, ? AS tipo, ? AS data_instalacao, ? AS ciclo_filtro_dias, "
                           "? AS responsavel_id, ? AS obs, ? AS fabricante, ? AS serie, ? AS status_op, "
                           "? AS intervalo_prev_dias, ? AS ultima_limpeza_filtro, ? AS atualizado_por")
            params += [
                uc["id"], uc.get("codigo"), uc.get("nome"), uc.get("categoria"),
                uc.get("local"), uc.get("modelo"), uc.get("capacidadeBtu"),
                uc.get("tipo"), to_date_or_none(uc.get("dataInstalacao")),
                uc.get("cicloFiltroDias"), uc.get("responsavelId"), uc.get("obs"),
                uc.get("fabricante"), uc.get("serie"), uc.get("statusOp", "Operacional"),
                uc.get("intervaloPrevDias", 0), to_date_or_none(uc.get("ultimaLimpezaFiltro")), u
            ]
        origem = " UNION ALL ".join(selects)
        await arun_exec_retry(f"""
            MERGE INTO {S_CONFORTO}.ucs AS t
            USING ({origem}) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                codigo=s.codigo, nome=s.nome, categoria=s.categoria, local=s.local, modelo=s.modelo,
                capacidade_btu=s.capacidade_btu, tipo=s.tipo, data_instalacao=s.data_instalacao,
                ciclo_filtro_dias=s.ciclo_filtro_dias, responsavel_id=s.responsavel_id, obs=s.obs,
                fabricante=s.fabricante, serie=s.serie, status_op=s.status_op,
                intervalo_prev_dias=s.intervalo_prev_dias, ultima_limpeza_filtro=s.ultima_limpeza_filtro,
                atualizado_por=s.atualizado_por
            WHEN NOT MATCHED THEN INSERT
                (id,codigo,nome,categoria,local,modelo,capacidade_btu,tipo,
                 data_instalacao,ciclo_filtro_dias,responsavel_id,obs,
                 fabricante,serie,status_op,intervalo_prev_dias,
                 ultima_limpeza_filtro,atualizado_por)
            VALUES (s.id,s.codigo,s.nome,s.categoria,s.local,s.modelo,s.capacidade_btu,s.tipo,
                    s.data_instalacao,s.ciclo_filtro_dias,s.responsavel_id,s.obs,
                    s.fabricante,s.serie,s.status_op,s.intervalo_prev_dias,
                    s.ultima_limpeza_filtro,s.atualizado_por)
        """, params)

        ids_com_checklist = [uc["id"] for uc in ucs if uc.get("checklistProprio")]
        if ids_com_checklist:
            placeholders_ck = ",".join(["?" for _ in ids_com_checklist])
            await arun_exec_retry(
                f"DELETE FROM {S_CONFORTO}.uc_checklist WHERE uc_id IN ({placeholders_ck})",
                ids_com_checklist
            )
        checklist_rows = []
        checklist_params = []
        for uc in ucs:
            for i, item in enumerate(uc.get("checklistProprio", [])):
                checklist_rows.append("(?,?,?,?,?)")
                checklist_params += [f"{uc['id']}_c_{i}", uc["id"], item, i, u]
        if checklist_rows:
            await arun_exec_retry(f"""
                INSERT INTO {S_CONFORTO}.uc_checklist (id,uc_id,item,ordem,atualizado_por)
                VALUES {",".join(checklist_rows)}
            """, checklist_params)

async def _salvar_preventivas(body, u):
    ids_front = [p["id"] for p in body.get("preventivas", [])]
    if ids_front:
        placeholders = ",".join(["?" for _ in ids_front])
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.preventivas WHERE id NOT IN ({placeholders}) AND origem != 'qr'",
            ids_front
        )
    else:
        await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.preventivas WHERE origem != 'qr'")

    preventivas = body.get("preventivas", [])
    if preventivas:
        selects = []
        params = []
        for p in preventivas:
            selects.append(
                "SELECT ? AS id, ? AS uc_id, ? AS tecnico_id, "
                "? AS data_prevista, ? AS data_realizada, ? AS status, "
                "? AS obs, ? AS origem, ? AS atualizado_por"
            )
            params += [
                p["id"], p.get("ucId"), p.get("tecnicoId"),
                to_date_or_none(p.get("dataPrevista")), to_date_or_none(p.get("dataRealizada")),
                p.get("status"), p.get("obs"), p.get("origem", "manual"), u
            ]
        origem = " UNION ALL ".join(selects)
        await arun_exec_retry(f"""
            MERGE INTO {S_CONFORTO}.preventivas AS t
            USING ({origem}) AS s ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                uc_id=s.uc_id, tecnico_id=s.tecnico_id,
                data_prevista=s.data_prevista, data_realizada=s.data_realizada,
                status=s.status, obs=s.obs,
                origem=s.origem, atualizado_por=s.atualizado_por
            WHEN NOT MATCHED THEN INSERT
                (id,uc_id,tecnico_id,data_prevista,data_realizada,
                 status,obs,origem,atualizado_por)
            VALUES (s.id,s.uc_id,s.tecnico_id,s.data_prevista,s.data_realizada,
                 s.status,s.obs,s.origem,s.atualizado_por)
        """, params)

    # checklist em lote
    ids_com_checklist = [p["id"] for p in preventivas if p.get("checklist") is not None]
    if ids_com_checklist:
        ph = ",".join(["?" for _ in ids_com_checklist])
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.preventiva_checklist WHERE preventiva_id IN ({ph})",
            ids_com_checklist
        )
    cl_rows = []
    cl_params = []
    for p in preventivas:
        for i, item in enumerate(p.get("checklist", [])):
            nome = item if isinstance(item, str) else item.get("item", "")
            conc = False if isinstance(item, str) else bool(item.get("concluido", False))
            cl_rows.append("(?,?,?,?,?,?)")
            cl_params += [f"{p['id']}_c_{i}", p["id"], nome, conc, i, u]
    if cl_rows:
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.preventiva_checklist (id,preventiva_id,item,concluido,ordem,atualizado_por)
            VALUES {",".join(cl_rows)}
        """, cl_params)

    # tecnicos em lote
    ids_com_tec = [p["id"] for p in preventivas if p.get("tecnicos") is not None]
    if ids_com_tec:
        ph = ",".join(["?" for _ in ids_com_tec])
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.preventiva_tecnicos WHERE preventiva_id IN ({ph})",
            ids_com_tec
        )
    tec_rows = []
    tec_params = []
    for p in preventivas:
        for tec in p.get("tecnicos", []):
            tec_rows.append("(?,?,?,?)")
            tec_params += [f"{p['id']}_t_{tec}", p["id"], tec, u]
    if tec_rows:
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.preventiva_tecnicos (id,preventiva_id,nome_tecnico,atualizado_por)
            VALUES {",".join(tec_rows)}
        """, tec_params)

async def _salvar_tecnicos(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.tecnicos")
    tecnicos = body.get("tecnicos", [])
    if tecnicos:
        rows = []
        params = []
        for t in tecnicos:
            rows.append("(?,?,?,?,?,?)")
            params += [t["id"], t.get("nome"), t.get("matricula"),
                       t.get("especialidade"), t.get("turno"), u]
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.tecnicos
                (id,nome,matricula,especialidade,turno,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_ordens(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.ordens")
    ordens = body.get("ordens", [])
    if ordens:
        rows = []
        params = []
        for o in ordens:
            rows.append("(?,?,?,?,?,?,?,?,?,?,?,?)")
            params += [
                o["id"], o.get("tipo"), o.get("areaId"), o.get("responsavelId"),
                to_date_or_none(o.get("dataPrevista")), to_date_or_none(o.get("datarealizada")),
                o.get("status"), o.get("horainicio", "08:00"), o.get("horafim", "09:00"),
                o.get("obs"), o.get("origemrotina"), u
            ]
        await arun_exec_retry(f"""
            insert into {S_CONFORTO}.ordens
                (id,tipo,area_id,responsavel_id,data_prevista,data_realizada,
                 status,hora_inicio,hora_fim,obs,origem_rotina,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_manutencoes(body, u):
    ids_front = [m["id"] for m in body.get("manutencoes", [])]
    if ids_front:
        placeholders = ",".join(["?" for _ in ids_front])
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.manutencoes WHERE id NOT IN ({placeholders}) AND (atualizado_por IS NULL OR atualizado_por != 'qr')",
            ids_front
        )
    else:
        await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.manutencoes WHERE atualizado_por != 'qr'")

    manutencoes = body.get("manutencoes", [])

    # MERGE em lote para manutencoes
    if manutencoes:
        selects = []
        params = []
        for m in manutencoes:
            selects.append(
                "SELECT ? AS id, ? AS uc_id, ? AS tecnico_id, ? AS tipo, ? AS falha, "
                "? AS data_abertura, ? AS data_fechamento, ? AS status, "
                "? AS custo_estimado, ? AS obs, ? AS atualizado_por"
            )
            params += [
                m["id"], m.get("ucId"), m.get("tecnicoId"), m.get("tipo", "Manutenção"), m.get("falha"),
                to_date_or_none(m.get("dataAbertura")), to_date_or_none(m.get("dataFechamento")),
                m.get("status"), m.get("custoEstimado", 0), m.get("obs"), u
            ]
        origem = " UNION ALL ".join(selects)
        await arun_exec_retry(f"""
            MERGE INTO {S_CONFORTO}.manutencoes AS t
            USING ({origem}) AS s ON t.id = s.id
            WHEN MATCHED AND (t.atualizado_por IS NULL OR t.atualizado_por != 'qr') THEN UPDATE SET
                uc_id=s.uc_id, tecnico_id=s.tecnico_id, tipo=s.tipo, falha=s.falha,
                data_abertura=s.data_abertura, data_fechamento=s.data_fechamento,
                status=s.status, custo_estimado=s.custo_estimado, obs=s.obs, atualizado_por=s.atualizado_por
            WHEN NOT MATCHED THEN INSERT
                (id,uc_id,tecnico_id,tipo,falha,data_abertura,data_fechamento,status,custo_estimado,obs,atualizado_por)
            VALUES (s.id,s.uc_id,s.tecnico_id,s.tipo,s.falha,s.data_abertura,s.data_fechamento,
                    s.status,s.custo_estimado,s.obs,s.atualizado_por)
        """, params)

    # pecas em lote: DELETE apenas onde atualizado_por != 'qr', INSERT em lote
    ids_com_pecas = [m["id"] for m in manutencoes
                     if isinstance(m.get("pecas") or m.get("pecasUtilizadas") or m.get("pecasSelecionadas"), list)]
    if ids_com_pecas:
        ph = ",".join(["?" for _ in ids_com_pecas])
        await arun_exec_retry(
            f"DELETE FROM {S_CONFORTO}.manutencao_pecas WHERE manutencao_id IN ({ph}) AND atualizado_por != 'qr'",
            ids_com_pecas
        )
    peca_rows = []
    peca_params = []
    for m in manutencoes:
        pecas_usadas = m.get("pecas") or m.get("pecasUtilizadas") or m.get("pecasSelecionadas") or []
        if not isinstance(pecas_usadas, list):
            continue
        for pu in pecas_usadas:
            if not isinstance(pu, dict):
                continue
            peca_id = pu.get("pecaId")
            if not peca_id:
                continue
            peca_rows.append("(?,?,?,?,?,?)")
            peca_params += [f"{m['id']}_p_{peca_id}", m["id"], peca_id, pu.get("nome"), pu.get("quantidade", 1), u]
    if peca_rows:
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.manutencao_pecas (id,manutencao_id,peca_id,nome_peca,quantidade,atualizado_por)
            VALUES {",".join(peca_rows)}
        """, peca_params)

async def _salvar_pecas(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.pecas")
    pecas = body.get("pecas", [])
    if pecas:
        rows = []
        params = []
        for p in pecas:
            rows.append("(?,?,?,?,?,?,?,?,?,?,?)")
            params += [
                p["id"], p.get("codigo"), p.get("descricao"), p.get("categoria"),
                p.get("fabricante"), p.get("referencia"), p.get("unidade"),
                p.get("estqAtual", 0), p.get("estqMinimo", 0), p.get("custoUnitario", 0), u
            ]
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.pecas
                (id,codigo,descricao,categoria,fabricante,referencia,
                 unidade,estq_atual,estq_minimo,custo_unitario,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_requisicoes(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.requisicoes")
    requisicoes = body.get("requisicoes", [])
    if requisicoes:
        rows = []
        params = []
        for r in requisicoes:
            rows.append("(?,?,?,?,?,?,?,?)")
            params += [
                r["id"], r.get("pecaId"), r.get("quantidade"), r.get("destino"),
                r.get("solicitanteId"), to_date_or_none(r.get("dataNecessidade")),
                r.get("status"), u
            ]
        await arun_exec_retry(f"""
            insert into {S_CONFORTO}.requisicoes
                (id,peca_id,quantidade,destino,solicitante_id,
                 data_necessidade,status,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_areas(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.areas")
    areas = body.get("areas", [])
    if areas:
        rows = []
        params = []
        for a in areas:
            rows.append("(?,?,?,?,?,?,?,?,?,?)")
            params += [
                a["id"], a.get("nome"), a.get("local"), a.get("tipo"),
                a.get("metragem", 0), a.get("freqCivil"), a.get("freqTecnica"),
                a.get("responsavelId"), a.get("obs"), u
            ]
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.areas
                (id,nome,local,tipo,metragem,freq_civil,
                 freq_tecnica,responsavel_id,obs,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_fornecedores(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.fornecedores")
    fornecedores = body.get("fornecedores", [])
    if fornecedores:
        rows = []
        params = []
        for f in fornecedores:
            rows.append("(?,?,?,?,?,?,?,?,?)")
            params += [
                f["id"], f.get("nome"), f.get("cnpj"), f.get("tipoServico"),
                f.get("contato"), f.get("telefone"), f.get("email"),
                f.get("ativo", "Sim"), u
            ]
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.fornecedores
                (id,nome,cnpj,tipo_servico,contato,telefone,email,ativo,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

async def _salvar_rotinas(body, u):
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.rotinas")
    await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.rotina_dias")
    rotinas = body.get("rotinas", [])
    if rotinas:
        rows = []
        params = []
        for r in rotinas:
            rows.append("(?,?,?,?,?,?,?,?,?,?)")
            params += [
                r["id"], r.get("nome"), r.get("tipo"), r.get("areaId"),
                r.get("responsavelId"), r.get("frequencia"),
                r.get("horaInicio", "08:00"), r.get("horaFim", "09:00"),
                r.get("ativa", True), u
            ]
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.rotinas
                (id,nome,tipo,area_id,responsavel_id,frequencia,
                 hora_inicio,hora_fim,ativa,atualizado_por)
            VALUES {",".join(rows)}
        """, params)

    dia_rows = []
    dia_params = []
    for r in rotinas:
        for dia in r.get("diasSemana", []):
            dia_rows.append("(?,?,?,?)")
            dia_params += [f"{r['id']}_{dia}", r["id"], dia, u]
    if dia_rows:
        await arun_exec_retry(f"""
            INSERT INTO {S_CONFORTO}.rotina_dias (id,rotina_id,dia_semana,atualizado_por)
            VALUES {",".join(dia_rows)}
        """, dia_params)

@app.post("/api/conforto")
async def save_conforto(request: Request):
    body = await request.json()
    u = get_usuario(request)
    try:
        await _salvar_tecnicos(body, u)
        await _salvar_areas(body, u)
        await _salvar_fornecedores(body, u)
        await _salvar_pecas(body, u)
        await _salvar_ucs(body, u)
        await _salvar_preventivas(body, u)
        await _salvar_ordens(body, u)
        await _salvar_manutencoes(body, u)
        await _salvar_requisicoes(body, u)
        await _salvar_rotinas(body, u)
        if "config" in body:
            c = body["config"]
            await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.config")
            await arun_exec_retry(f"""
                INSERT INTO {S_CONFORTO}.config
                    (ciclo_filtro_dias,alerta_preventiva_dias,alerta_limpeza_dias,
                     alerta_manutencao_dias,
                     frequencias_escritorio,frequencias_banheiro,frequencias_refeitorio,
                     frequencias_area_tecnica,frequencias_corredor,frequencias_almoxarifado)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, [
                c.get("cicloFiltroDias", 90), c.get("alertaPreventivaDias", 7),
                c.get("alertaLimpezaDias", 2), c.get("alertaManutencaoDias", 3),
                c.get("frequencias", {}).get("escritorio", "Diário"),
                c.get("frequencias", {}).get("banheiro", "Diário"),
                c.get("frequencias", {}).get("refeitorio", "Diário"),
                c.get("frequencias", {}).get("areaTecnica", "Semanal"),
                c.get("frequencias", {}).get("corredor", "Semanal"),
                c.get("frequencias", {}).get("almoxarifado", "Quinzenal"),
            ])
            await arun_exec_retry(f"DELETE FROM {S_CONFORTO}.config_checklist")
            checklist_cfg = c.get("checklistPreventiva", [])
            if checklist_cfg:
                cfg_rows = []
                cfg_params = []
                for i, item in enumerate(checklist_cfg):
                    cfg_rows.append("(?,?,?,?)")
                    cfg_params += [f"cfg_{i}", item, i, u]
                await arun_exec_retry(f"""
                    INSERT INTO {S_CONFORTO}.config_checklist (id,item,ordem,atualizado_por)
                    VALUES {",".join(cfg_rows)}
                """, cfg_params)
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
async def root(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return RedirectResponse(url="/kpi")

@app.get("/hub")
async def hub(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return inject(f"{BASE}/hub/hub.html", {})

@app.get("/chamados")
async def chamados_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return inject(f"{BASE}/chamados/chamados.html", get_cached("chamados"))

@app.get("/obras")
async def obras_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return FileResponse(f"{BASE}/obras/obras.html")

@app.get("/codin")
async def codin_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return inject(f"{BASE}/codins/codin.html", get_cached("codin"))

@app.get("/conforto")
async def conforto_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return inject(f"{BASE}/conforto/conforto.html", get_cached("conforto"))

@app.get("/atividades")
async def atividades_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
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
async def kpi_page(request: Request):
    if not usuario_autenticado(request):
        return RedirectResponse(url="/login")
    return inject(f"{BASE}/kpi/kpi.html", {
        "chamados":   get_cached("chamados"),
        "obras":      get_cached("obras"),
        "atividades": get_cached("atividades"),
        "conforto":   get_cached("conforto"),
    })

@app.get("/admin")
async def admin_page(request: Request):
    user = usuario_autenticado(request)
    if not user:
        return RedirectResponse(url="/login")
    if user.get("role") != "admin":
        return RedirectResponse(url="/kpi")
    return FileResponse(f"{BASE}/admin/admin.html")

@app.get("/login")
async def login_page(request: Request):
    if usuario_autenticado(request):
        return RedirectResponse(url="/kpi")
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
            checklist_proprio_rows = await arun_query(
                f"SELECT item FROM {S_CONFORTO}.uc_checklist WHERE uc_id=? ORDER BY ordem", [uc_id]
            )
            checklist_proprio = [r["item"] for r in checklist_proprio_rows] if checklist_proprio_rows else []
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
                "checklistProprio": checklist_proprio,
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

@app.get("/api/conforto/manutencoes/{mid}/custo-pecas")
async def custo_pecas_manutencao(mid: str):
    rows = await arun_query(f"""
        SELECT mp.peca_id, mp.qtd, p.custo_unitario, p.descricao,
               (mp.qtd * COALESCE(p.custo_unitario, 0)) AS custo_total
        FROM {S_CONFORTO}.manutencao_pecas mp
        JOIN {S_CONFORTO}.pecas p ON p.id = mp.peca_id
        WHERE mp.manutencao_id = ?
    """, [mid])
    total = sum(r["custo_total"] for r in rows) if rows else 0
    return JSONResponse({"itens": rows, "custoTotal": total})

@app.post("/api/conforto/preventivas")
async def criar_preventiva_qr(request: Request):
    body = await request.json()
    try:
        pid = body["id"]
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.preventivas
                (id, uc_id, tecnico_id, data_prevista, data_realizada,
                 status, obs, origem, atualizado_por,
                 inicio_em, fim_em, duracao_min, num_pessoas, foto_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, [
            pid, body.get("ucId"), None,
            body.get("dataPrevista"), body.get("dataRealizada", body.get("dataPrevista")),
            body.get("status", "Realizada"),
            body.get("obs", ""), "qr", "qr",
            body.get("inicioEm"), body.get("fimEm"),
            body.get("duracaoMin"), body.get("numPessoas"),
            body.get("foto")
        ])
        for i, item in enumerate(body.get("checklist", [])):
            nome = item if isinstance(item, str) else item.get("item", "")
            conc = False if isinstance(item, str) else bool(item.get("concluido", False))
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.preventiva_checklist (id,preventiva_id,item,concluido,ordem,atualizado_por)
                VALUES (?,?,?,?,?,?)
            """, [f"{pid}_c_{i}", pid, nome, conc, i, "qr"])
        for tec in body.get("tecnicos", []):
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.preventiva_tecnicos (id,preventiva_id,nome_tecnico,atualizado_por)
                VALUES (?,?,?,?)
            """, [f"{pid}_t_{tec}", pid, tec, "qr"])
    except Exception as e:
        import traceback
        print(f"[conforto] erro ao criar preventiva qr: {e}")
        print(traceback.format_exc())
        return JSONResponse({"erro": str(e)}, status_code=500)
    cache_invalidate("conforto")
    return JSONResponse({"ok": True})

@app.post("/api/conforto/manutencoes-qr")
async def criar_manutencao_qr(request: Request):
    body = await request.json()
    try:
        mid = body["id"]
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.manutencoes
                (id, uc_id, tecnico_id, tipo, falha, data_abertura,
                 status, obs, atualizado_por, foto_url)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, [
            mid, body.get("ucId"), None,
            body.get("tipo", "Corretiva"),
            body.get("falha", ""),
            body.get("dataAbertura"),
            body.get("status", "Em Aberto"),
            body.get("obs", ""), "qr",
            body.get("foto")
        ])
        for tec in body.get("tecnicos", []):
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.manutencao_tecnicos (id,manutencao_id,nome_tecnico,atualizado_por)
                VALUES (?,?,?,?)
            """, [f"{mid}_t_{tec}", mid, tec, "qr"])
        if body.get("inicioEm"):
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.manutencao_sessoes
                    (id,manutencao_id,tipo_sessao,inicio_em,fim_em,duracao_min,motivo_pausa,atualizado_por,criado_em)
                VALUES (?,?,?,?,?,?,?,?,current_timestamp())
            """, [f"{mid}_t_0", mid, "trabalho",
                  body.get("inicioEm"), body.get("fimEm"),
                  body.get("duracaoMin"), None, "qr"])
        for peca in body.get("pecasSelecionadas", []):
            await arun_exec(f"""
                INSERT INTO {S_CONFORTO}.manutencao_pecas (id,manutencao_id,peca_id,nome_peca,quantidade,atualizado_por)
                VALUES (?,?,?,?,?,?)
            """, [f"{mid}_p_{peca.get('pecaId','')}", mid,
                  peca.get("pecaId"), peca.get("nome"),
                  peca.get("quantidade", 1), "qr"])
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
            sets.append("data_fechamento=?"); vals.append(body["fimEm"])
        if "pausas" in body:
            for pausa in body["pausas"]:
                sess_id = f"{mid}_p_{pausa.get('motivo','')[:8]}_{int(asyncio.get_event_loop().time())}"
                await arun_exec(f"""
                    INSERT INTO {S_CONFORTO}.manutencao_sessoes
                        (id,manutencao_id,tipo_sessao,inicio_em,fim_em,duracao_min,motivo_pausa,atualizado_por,criado_em)
                    VALUES (?,?,?,?,?,?,?,?,current_timestamp())
                """, [sess_id, mid, "pausa", pausa.get("inicio"), pausa.get("fim"), pausa.get("duracaoMin"), pausa.get("motivo"), "qr"])
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
            "numPessoas": len((await arun_query(
                f"SELECT id FROM {S_CONFORTO}.manutencao_tecnicos WHERE manutencao_id=?", [mid]
            )) or []) or 1,
            "tecnicos":   [t["nome_tecnico"] for t in (await arun_query(
                f"SELECT nome_tecnico FROM {S_CONFORTO}.manutencao_tecnicos WHERE manutencao_id=?", [mid]
            ) or [])],
            "sessoes":    [{
                "tipoSessao":  s["tipo_sessao"],
                "inicioEm":    _ts(s.get("inicio_em")) or "",
                "fimEm":       _ts(s.get("fim_em")) or "",
                "duracaoMin":  s.get("duracao_min"),
                "motivoPausa": s.get("motivo_pausa") or "",
            } for s in (await arun_query(
                f"SELECT * FROM {S_CONFORTO}.manutencao_sessoes WHERE manutencao_id=? ORDER BY inicio_em", [mid]
            ) or [])],
            "duracaoMin": ((await arun_query(
                f"SELECT COALESCE(SUM(duracao_min),0) AS total FROM {S_CONFORTO}.manutencao_sessoes WHERE manutencao_id=? AND tipo_sessao='trabalho'", [mid]
            ) or [{"total": 0}])[0]["total"]),
        }, default=str)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/conforto/manutencoes/{mid}/concluir")
async def concluir_manutencao(mid: str, request: Request):
    body = await request.json()
    try:
        duracao_atual = body.get("duracaoMin", 0) or 0
        sess_id = f"{mid}_t_{int(asyncio.get_event_loop().time())}"
        await arun_exec(f"""
            INSERT INTO {S_CONFORTO}.manutencao_sessoes
                (id,manutencao_id,tipo_sessao,inicio_em,fim_em,duracao_min,motivo_pausa,atualizado_por,criado_em)
            VALUES (?,?,?,?,?,?,?,?,current_timestamp())
        """, [sess_id, mid, "trabalho",
              body.get("inicioEm"), body.get("fimEm"),
              duracao_atual, None, "qr"])
        rows = await arun_query(
            f"SELECT COALESCE(SUM(duracao_min),0) AS total FROM {S_CONFORTO}.manutencao_sessoes WHERE manutencao_id=? AND tipo_sessao='trabalho'", [mid]
        )
        duracao_total = (rows or [{"total": 0}])[0]["total"]
        await arun_exec(f"""
            UPDATE {S_CONFORTO}.manutencoes SET
                status=?, data_fechamento=?, foto_url=?, obs=?, atualizado_por=?
            WHERE id=?
        """, ["Concluída", body.get("fimEm"), body.get("foto"), body.get("obs",""), "qr", mid])
        for tec in body.get("tecnicos", []):
            existing = await arun_query(
                f"SELECT id FROM {S_CONFORTO}.manutencao_tecnicos WHERE manutencao_id=? AND nome_tecnico=?", [mid, tec]
            )
            if not existing:
                await arun_exec(f"""
                    INSERT INTO {S_CONFORTO}.manutencao_tecnicos (id,manutencao_id,nome_tecnico,atualizado_por)
                    VALUES (?,?,?,?)
                """, [f"{mid}_t_{tec}", mid, tec, "qr"])
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
                   CAST(data_abertura AS STRING) AS data_abertura, obs
            FROM {S_CONFORTO}.manutencoes
            WHERE status IN ('Em Aberto', 'Em Andamento', 'Aguardando Peça')
            ORDER BY data_abertura DESC
        """)
        for m in manutencoes:
            tecs = await arun_query(
                f"SELECT nome_tecnico FROM {S_CONFORTO}.manutencao_tecnicos WHERE manutencao_id=?",
                [m["id"]]
            )
            m["tecnicos"] = [t["nome_tecnico"] for t in tecs]
        preventivas = await arun_query(f"""
            SELECT id, uc_id, status,
                   CAST(data_prevista AS STRING) AS data_prevista
            FROM {S_CONFORTO}.preventivas
            WHERE status IN ('Pendente', 'Em Atraso')
            ORDER BY data_prevista ASC
        """)
        for p in preventivas:
            tecs = await arun_query(
                f"SELECT nome_tecnico FROM {S_CONFORTO}.preventiva_tecnicos WHERE preventiva_id=?",
                [p["id"]]
            )
            p["tecnicos"] = [t["nome_tecnico"] for t in tecs]
        import json as _json
        resp = HTMLResponse(
            content=_json.dumps({
                "manutencoes": manutencoes or [],
                "preventivas": preventivas or []
            }, default=str),
            media_type="application/json"
        )
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        return resp
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
