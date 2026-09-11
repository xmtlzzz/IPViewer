import openpyxl, sys, io
sys.stdout.reconfigure(encoding='utf-8')
p = r"C:\Users\xmctlz\.dsh\attachments\v1\files\5f\5fe61761c94a69b7080312bc19c288ccb058fa6d6995f7c41a5137c4c9857f61\华为设备已配置IP统计.xlsx"
import os
if not os.path.exists(p):
    import glob
    p = glob.glob(r"C:\Users\xmtlz\.dsh\attachments\v1\files\5f\*\*.xlsx")[0]
wb = openpyxl.load_workbook(p)
ws = wb.active
print("sheet:", ws.title, "dims:", ws.dimensions)
for r in ws.iter_rows(values_only=True):
    print(" | ".join(("" if c is None else str(c)) for c in r))
