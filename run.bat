@echo off
REM Enhanced Log ���R���x v6 �Ұʸ}�� (Windows)

echo ========================================
echo ?? Enhanced Log ���R���x v6 �Ұʤ�...
echo ========================================

REM �ˬd Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ? ���~: �䤣�� Python�A�Х��w�� Python 3.8+
    pause
    exit /b 1
)

echo ? Python �w�w��

REM �ˬd��������
if not exist "venv" (
    echo ??  �������Ҥ��s�b�A���b�Ы�...
    python -m venv venv
    echo ? �������ҳЫا���
)

REM �Ұʵ�������
echo ?? �Ұʵ�������...
call venv\Scripts\activate

REM �w�˨̿�
echo ?? �ˬd�æw�˨̿�...
pip install -r requirements.txt

REM �Ыإ��n�ؿ�
echo ?? �Ыإ��n�ؿ�...
if not exist "uploads\chat" mkdir uploads\chat
if not exist "uploads\archives" mkdir uploads\archives
if not exist "static\js" mkdir static\js
if not exist "static\css" mkdir static\css
if not exist "templates" mkdir templates
echo ? �ؿ��Ыا���

REM �]�m�����ܼ�
set FLASK_APP=app.py
set FLASK_ENV=development

REM �Ұ�����
echo.
echo ========================================
echo ?? �Ұ�����...
echo ========================================
echo ?? �X�ݦa�}: http://localhost:5000
echo ?? �� Ctrl+C ��������
echo ========================================
echo.

REM �Ұ� Flask ����
python app.py

pause