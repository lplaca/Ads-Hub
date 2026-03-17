"""
Meta Ads Control Center - Launcher
Run: python start.py
"""
import subprocess, sys, os

def run():
    print("\n" + "="*50)
    print("  Meta Ads Control Center v2")
    print("  Iniciando plataforma...")
    print("="*50 + "\n")

    print("[1/2] Instalando dependências...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    print("      OK!\n")

    print("[2/2] Iniciando servidor...")
    print("      Acesse: http://localhost:8000\n")

    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

if __name__ == "__main__":
    run()
