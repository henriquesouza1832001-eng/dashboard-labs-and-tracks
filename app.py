from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

app.mount('/hub', StaticFiles(directory='ERPFiat-Portatil/resources/hub'), name='hub')
app.mount('/chamados', StaticFiles(directory='ERPFiat-Portatil/resources/chamados'), name='chamados')
app.mount('/obras', StaticFiles(directory='ERPFiat-Portatil/resources/obras'), name='obras')
app.mount('/kpi', StaticFiles(directory='ERPFiat-Portatil/resources/kpi'), name='kpi')
app.mount('/codins', StaticFiles(directory='ERPFiat-Portatil/resources/codins'), name='codins')
app.mount('/conforto', StaticFiles(directory='ERPFiat-Portatil/resources/conforto'), name='conforto')
app.mount('/atividades', StaticFiles(directory='ERPFiat-Portatil/resources/atividades'), name='atividades')
app.mount('/js', StaticFiles(directory='ERPFiat-Portatil/resources/js'), name='js')

@app.get('/')
async def root():
    return FileResponse('ERPFiat-Portatil/resources/hub/hub.html')

@app.get('/health')
async def health():
    return {'status': 'ok'}

