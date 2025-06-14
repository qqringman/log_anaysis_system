# Enhanced Log ���R���x v6 - ����\��ɯŪ�

## ?? �\��S��

### �֤ߥ\��
- **�y����x���R**: �Y�ɤ��R�j����x�ɮסA�䴩�h�خ榡
- **����r�˴�**: �Ҳդ�����r�޲z�A�䴩��q�פJ
- **��ı�Ʋέp**: �Y�ɹϪ�i�ܤ��R���G
- **�ɮ��s����**: ���㪺�ɮרt���s���\��

### �s�W�\�� (v6)
1. **�����ѫǨt��**
   - �Y�ɲ�ѻP���v�O��
   - �ЫةM�޲z�h�Ӳ�ѫ�
   - �W�߲�ѫǭ���
   - �u�W�Τ�C��P @���Υ\��

2. **�s���t��**
   - �V�Ҧ��u�W�Τ�o�e�q��
   - �۩w�q�T���M�u����

3. **���ʥ\��**
   - �۩w�q���B��L
   - �벼�t��
   - �ɮפ���
   - �䴩�Ϥ��M�s��

4. **��ѫǺ޲z����**
   - �����޲z�Ҧ���ѫ�
   - �d�ݸ귽�M���ʰO��

5. **�i��ʰ϶��]�p**
   - ���� JIRA Dashboard ���G��
   - �䴩�h�اG���Ҧ��]�w�]�B����B�r���y�^
   - �϶��i�ۥѩ�ʱƧ�

6. **�T�����]�p**
   - �q����/���������
   - �䴩 Android/iOS �˵��Ҧ�

7. **���ɥ\��**
   - ���R���G���ɡ]���}/�p�K�^
   - ���ɺ޲z����
   - �L���ɶ�����

## ?? �t�λݨD

- Python 3.8+
- �䴩���@�~�t��: Linux, macOS, Windows
- �s����: Chrome, Firefox, Safari, Edge (�̷s����)

## ??? �w�˨B�J

1. **�J���M��**
   ```bash
   git clone https://github.com/your-repo/enhanced-log-analysis-v6.git
   cd enhanced-log-analysis-v6
   ```

2. **�إߵ�������**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Linux/macOS
   source venv/bin/activate
   ```

3. **�w�˨̿�**
   ```bash
   pip install -r requirements.txt
   ```

4. **�إߥ��n�ؿ�**
   ```bash
   mkdir -p uploads/chat
   mkdir -p uploads/archives
   mkdir -p static/js
   mkdir -p static/css
   mkdir -p templates
   ```

5. **�Ұ�����**
   ```bash
   python app.py
   ```

6. **�X������**
   ���}�s�����X��: `http://localhost:5000`

## ?? �M�׵��c

```
enhanced-log-analysis-v6/
�u�w�w app.py                     # �D���ε{��
�u�w�w requirements.txt           # Python �̿�
�u�w�w README.md                 # �M�׻���
�u�w�w templates/                # HTML �ҪO
�x   �u�w�w enhanced_index_v2.html    # �D����
�x   �u�w�w room.html                 # ��ѫǭ���
�x   �u�w�w room_manager.html         # ��ѫǺ޲z
�x   �u�w�w analysis_report.html      # ���R���i
�x   �u�w�w shared_report.html        # ���ɳ��i
�x   �|�w�w enhanced_file_viewer.html # �ɮ��˵���
�u�w�w static/                   # �R�A�귽
�x   �u�w�w js/
�x   �x   �|�w�w enhanced-app-v6.js    # �D�n JavaScript
�x   �|�w�w css/
�x       �|�w�w custom-styles.css     # �۩w�q�˦�
�u�w�w uploads/                  # �W���ɮץؿ�
�x   �u�w�w chat/                    # ��ѫ��ɮ�
�x   �|�w�w archives/                # ���Y�ɮ�
�u�w�w chat_data.db             # SQLite ��Ʈw
�|�w�w uploads/
    �|�w�w keywords_sample.csv  # ����r�d���ɮ�
```

## ?? �ϥΫ��n

### 1. ����r�޲z
- �W�� CSV �榡������r�ɮ�
- �榡�n�D: `Module,Keyword list`
- �䴩����W��

### 2. �ɮפ��R
- �s���ÿ�ܭn���R���ɮ�
- �䴩����ɮקֳt���R
- �䴩���Y�ɮ� (.zip, .7z, .tar.gz)

### 3. ��ѫǥ\��
- ��J�W�٫�i�[�J���
- �ϥ� @ ���Ψ�L�Τ�
- �䴩�ɮפW�ǩM����

### 4. �G���޲z
- �I���k�W�����s�����G���Ҧ�
- ��ʰ϶����D�i�歫�s�Ƨ�
- �I�� X �̤p�ư϶�

## ?? �t�m�ﶵ

### FastGrep �]�w
```python
'fastgrep_settings': {
    'threads': 4,        # �������
    'use_mmap': True,    # �O����M�g
    'context_lines': 0,  # �W�U����
    'timeout': 120       # �W�ɮɶ�(��)
}
```

### �ɮפj�p����
```python
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
```

## ?? �G�ٱư�

### �`�����D

1. **���R�L���G**
   - �T�{����r�榡���T
   - �ˬd�ɮ׽s�X�O�_�� UTF-8
   - �T�{ grep �R�O�i��

2. **Socket.IO �s������**
   - �ˬd������]�w
   - �T�{ eventlet �w�w��
   - �������ε{��

3. **�ɮפW�ǥ���**
   - �ˬd uploads �ؿ��v��
   - �T�{�ɮפj�p���W�L����

## ?? ��s��x

### v6.0 (2025-01-10)
- ? �״_���R����
- ? �s�W�����ѫǨt��
- ? �s�W�s���\��
- ? �䴩�۩w�q��L
- ? �s�W���ɥ\��
- ? �i��ʰ϶��]�p
- ? �T����������䴩

## ?? �^�m���n

�w�ﴣ�� Issue �M Pull Request�I

## ?? ���v

c 2025 Vince. All rights reserved.

## ?? �p���覡

�p�����D�Ϋ�ĳ�A���p���}�o�ζ��C