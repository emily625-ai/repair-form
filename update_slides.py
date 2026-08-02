#!/usr/bin/env python3
"""Update Emily's weekly report slides with FMS B-plan content from manager's email."""

import re

FONT = '<a:latin typeface="微軟正黑體" panose="020B0604030504040204" pitchFamily="34" charset="-120"/><a:ea typeface="微軟正黑體" panose="020B0604030504040204" pitchFamily="34" charset="-120"/>'

def rpr_zh(sz=2000):
    return f'<a:rPr lang="zh-TW" altLang="en-US" sz="{sz}" dirty="0">{FONT}</a:rPr>'

def rpr_en(sz=2000):
    return f'<a:rPr lang="en-US" altLang="zh-TW" sz="{sz}" dirty="0">{FONT}</a:rPr>'

def run_zh(text, sz=2000):
    return f'<a:r>{rpr_zh(sz)}<a:t>{text}</a:t></a:r>'

def run_en(text, sz=2000):
    return f'<a:r>{rpr_en(sz)}<a:t>{text}</a:t></a:r>'

def para_center(*runs):
    return f'<a:p><a:pPr algn="ctr"/>{"".join(runs)}</a:p>'

def para_left(*runs):
    return f'<a:p>{"".join(runs)}</a:p>'

def tc_center(content, anchor="ctr"):
    return f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>{content}</a:txBody><a:tcPr anchor="{anchor}"/></a:tc>'

def tc_plain(content):
    return f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>{content}</a:txBody><a:tcPr/></a:tc>'

def endpara_zh(sz=1200):
    return f'<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="zh-TW" altLang="en-US" sz="{sz}" dirty="0"/></a:p>'

def rowid(val):
    return f'<a:extLst><a:ext uri="{{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}}"><a16:rowId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="{val}"/></a:ext></a:extLst>'


# ─── SLIDE 2 ─── Fill first empty row with B計畫 (FMS工班問題評估)
slide2_path = "/home/user/repair-form/pptx_unpacked/ppt/slides/slide2.xml"

OLD_S2 = ('<a:tr h="1015216"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>'
           '<a:endParaRPr lang="zh-TW" altLang="en-US" dirty="0"/></a:p></a:txBody>'
           '<a:tcPr anchor="ctr"/></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>'
           '<a:endParaRPr lang="zh-TW" altLang="en-US" dirty="0"/></a:p></a:txBody>'
           '<a:tcPr anchor="ctr"/></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>'
           '<a:endParaRPr lang="zh-TW" altLang="en-US" dirty="0"/></a:p></a:txBody>'
           '<a:tcPr anchor="ctr"/></a:tc>'
           '<a:extLst><a:ext uri="{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}">'
           '<a16:rowId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="69086593"/>'
           '</a:ext></a:extLst></a:tr>')

# Col1: "B計畫"
col1 = tc_center(para_center(run_en('B', 2800), run_zh('計畫', 2800)))

# Col2: 起訖時間
col2 = tc_center(para_center(run_en('2026/8/1~2026/9/30', 2000)))

# Col3: 目標說明 (multi-line)
br = f'<a:br>{rpr_en(2000)}</a:br>'
col3_content = (
    f'<a:p>{run_zh("目標：評估FMS工班搶工問題，提供決策數據")}{br}'
    f'{run_en("1.")}{run_zh("整理2025/1起FMS硬體故障報修紀錄（新竹物流獨立統計）")}</a:p>'
    f'<a:p>{run_en("2.")}{run_zh("分析服務類及硬體銷售各面向月度數據（車輛數、營收、維修件數、故障率、工班費、維修料費）")}</a:p>'
    f'<a:p>{run_en("3.")}{run_zh("產出分析報告供管理層決策")}</a:p>'
)
col3 = tc_center(col3_content)

NEW_S2 = f'<a:tr h="1015216">{col1}{col2}{col3}{rowid("69086593")}</a:tr>'

with open(slide2_path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(OLD_S2, NEW_S2)
with open(slide2_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Slide 2 updated")


# ─── SLIDE 3 ─── Fill empty Gantt row with B計畫
# Empty row is h="1132324" - has 16 cells all empty
slide3_path = "/home/user/repair-form/pptx_unpacked/ppt/slides/slide3.xml"

# The empty row to replace:
OLD_S3_EMPTY = ('<a:tr h="1132324"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
                '<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="zh-TW" altLang="en-US" sz="1200" dirty="0"/>'
                '</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>')

def gantt_cell_center(text, sz=1600):
    """Cell with centered text."""
    if not text:
        return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
                f'<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="zh-TW" altLang="en-US" sz="{sz}" dirty="0"/>'
                f'</a:p></a:txBody><a:tcPr/></a:tc>')
    return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
            f'<a:p><a:pPr algn="ctr"/>{run_zh(text, sz)}'
            f'</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>')

def gantt_cell_date(sz=1600):
    """Date cell for B計畫 with two paragraphs."""
    return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
            f'<a:p><a:pPr algn="ctr"/>{run_en("2026/8/1", sz)}</a:p>'
            f'<a:p><a:pPr algn="ctr"/>{run_en("~", sz)}</a:p>'
            f'<a:p><a:pPr algn="ctr"/>{run_en("2026/9/30", sz)}</a:p>'
            f'</a:txBody><a:tcPr anchor="ctr"/></a:tc>')

def gantt_cell_name():
    """First col: B計畫 name."""
    return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
            f'<a:p><a:pPr algn="ctr"/>'
            f'{run_en("B", 1600)}{run_zh("計畫 (FMS工班評估)", 1600)}'
            f'</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>')

# 16 columns: 名稱, 起訖, 7W1, 7W2, 7W3, 7W4, 7W5, 8W1, 8W2, 8W3, 8W4, 8W5, 9W1, 9W2, 9W3, 9W4
gantt_cells = (
    gantt_cell_name() +
    gantt_cell_date() +
    gantt_cell_center('') +  # 7W1
    gantt_cell_center('') +  # 7W2
    gantt_cell_center('') +  # 7W3
    gantt_cell_center('') +  # 7W4
    gantt_cell_center('') +  # 7W5
    gantt_cell_center('資料蒐集') +   # 8W1
    gantt_cell_center('新竹物流分析') + # 8W2
    gantt_cell_center('月度數據整合') + # 8W3
    gantt_cell_center('分析報告初稿') + # 8W4
    gantt_cell_center('') +  # 8W5
    gantt_cell_center('呈報決策') +   # 9W1
    gantt_cell_center('') +  # 9W2
    gantt_cell_center('') +  # 9W3
    gantt_cell_center('')    # 9W4
)

NEW_S3 = f'<a:tr h="1132324">{gantt_cells}{rowid("4118203706")}</a:tr>'

# Read slide3
with open(slide3_path, 'r', encoding='utf-8') as f:
    s3 = f.read()

# Find and replace the empty row (h="1132324") - it ends just before </a:tbl>
# Build exact match for the empty row by looking for its rowId
old_row_pattern = r'<a:tr h="1132324">.*?<a16:rowId[^/]*/>\s*</a:ext></a:extLst></a:tr>'
match = re.search(old_row_pattern, s3, re.DOTALL)
if match:
    s3 = s3[:match.start()] + NEW_S3 + s3[match.end():]
    with open(slide3_path, 'w', encoding='utf-8') as f:
        f.write(s3)
    print("Slide 3 updated")
else:
    print("WARNING: Could not find empty row in slide 3")


# ─── SLIDE 4 ─── Add new row at end of 7月份進度報告
slide4_path = "/home/user/repair-form/pptx_unpacked/ppt/slides/slide4.xml"

# New row for FMS啟動 - same style as existing rows
new_row_s4 = (
    f'<a:tr h="370840">'
    f'{tc_center(para_center(run_zh("FMS工班問題評估 - 啟動", 1800)), "ctr")}'
    f'{tc_center(para_center(run_zh("8月 W1", 1800)), "ctr")}'
    f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
    f'<a:p>{run_zh("規劃中：依主管指示，啟動2025/1起FMS故障報修資料蒐集", 1800)}</a:p>'
    f'</a:txBody><a:tcPr anchor="ctr"/></a:tc>'
    f'{rowid("9000000001")}'
    f'</a:tr>'
)

# Insert before </a:tbl>
with open(slide4_path, 'r', encoding='utf-8') as f:
    s4 = f.read()
s4 = s4.replace('</a:tbl>', new_row_s4 + '</a:tbl>', 1)
with open(slide4_path, 'w', encoding='utf-8') as f:
    f.write(s4)
print("Slide 4 updated")


# ─── SLIDE 5 ─── Add new row at end of 下週重點
slide5_path = "/home/user/repair-form/pptx_unpacked/ppt/slides/slide5.xml"

# Build new row matching slide5's style (uses typeface without panose)
FONT5 = '<a:latin typeface="微軟正黑體"/><a:ea typeface="微軟正黑體"/><a:cs typeface="微軟正黑體"/>'
def rpr5_zh(sz=1800):
    return f'<a:rPr lang="zh-TW" altLang="en-US" sz="{sz}" dirty="0">{FONT5}</a:rPr>'
def run5_zh(text, sz=1800):
    return f'<a:r>{rpr5_zh(sz)}<a:t>{text}</a:t></a:r>'

new_row_s5 = (
    f'<a:tr h="370840">'
    f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
    f'<a:p><a:pPr algn="ctr"><a:buNone/></a:pPr>{run5_zh("FMS資料蒐集啟動")}'
    f'</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>'
    f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
    f'<a:p><a:pPr algn="ctr"><a:buNone/></a:pPr>'
    f'{run5_zh("依主管指示，啟動2025/1起FMS硬體故障報修紀錄整理；新竹物流需獨立統計分析。")}'
    f'</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>'
    f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>'
    f'<a:p>{run5_zh("確認資料來源欄位對應，完成資料清單初稿。")}'
    f'</a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>'
    f'{rowid("9000000002")}'
    f'</a:tr>'
)

with open(slide5_path, 'r', encoding='utf-8') as f:
    s5 = f.read()
s5 = s5.replace('</a:tbl>', new_row_s5 + '</a:tbl>', 1)
with open(slide5_path, 'w', encoding='utf-8') as f:
    f.write(s5)
print("Slide 5 updated")

print("\nAll slides updated successfully.")
