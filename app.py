from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

@app.get('/')
async def root():
    return FileResponse('ERPFiat-Portatil/resources/hub/hub.html')

@app.get('/health')
async def health():
    return {'status': 'ok'}

app.mount('/', StaticFiles(directory='ERPFiat-Portatil/resources', html=True), name='static')

