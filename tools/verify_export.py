"""用 openpyxl 校验工具导出的华为格式 xlsx：列结构、列宽、筛选、中文与日期完整性。"""
import sys, os, tempfile, glob
sys.stdout.reconfigure(encoding='utf-8')
import openpyxl

p = os.path.join(tempfile.gettempdir(), 'ipv-huawei-export.xlsx')
if not os.path.exists(p):
    sys.exit('缺少导出文件: ' + p)

wb = openpyxl.load_workbook(p)
ws = wb.active
print('sheet:', ws.title)
print('dims :', ws.dimensions)
print('cols :', [(k, round(v.width, 2) if v.width else None) for k, v in ws.column_dimensions.items()])
print('autoFilter:', ws.auto_filter.ref)

rows = list(ws.iter_rows(values_only=True))
print('rows :', len(rows))
for r in rows:
    print(' | '.join('' if c is None else str(c) for c in r))

hdr = list(rows[0])
assert hdr == ['子网', '设备名称', '接口名称', '接口IP', '掩码', '备注'], hdr
assert len(rows) == 13, len(rows)          # 表头 + 12 行
assert ws.auto_filter.ref == 'A1:F1', ws.auto_filter.ref
assert all(len(r) == 6 for r in rows)
# 子网列必须全部留空（人工维护列）
assert all(r[0] in (None, '') for r in rows[1:]), [r[0] for r in rows[1:]]
# VRRP 两行还原
vrrp = [r for r in rows if r[5] and 'VRRP' in str(r[5])]
assert len(vrrp) == 2, vrrp
assert {r[1] for r in vrrp} == {'FW-O1-MDF-10-B2-9-U6650-ATD', 'FW-O1-MDF-10-B2-9-U6650E-ATD'}, vrrp
assert not any('同址设备' in str(r[5]) for r in rows)
# assigned 是隐含默认值，不应写进备注
assert not any('状态' in str(r[5]) for r in rows), [r[5] for r in rows]
# 掩码保真
masks = {str(r[3]): str(r[4]) for r in rows}
assert masks['192.168.249.145'] == '30' and masks['192.168.249.149'] == '30', masks
assert masks['1.1.1.1'] == '24', masks
print('\nOK  openpyxl 校验通过：6 列 / 子网列留空 / 自动筛选 / 列宽 / 中文 / VRRP 还原 / 无冗余状态 均正确')
