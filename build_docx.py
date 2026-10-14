import sys
import json
import zipfile
import os

CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

def build_docx(paragraphs, output_path):
    p_elements = []
    for p in paragraphs:
        if isinstance(p, dict):
            text = p.get('text', '')
            is_bold = p.get('bold', False)
            color = p.get('color', None)
            highlight = p.get('highlight', None)
        else:
            text = str(p)
            is_bold = False
            color = None
            highlight = None
        
        escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        rpr = []
        if is_bold:
            rpr.append('<w:b/>')
        if color:
            rpr.append(f'<w:color w:val="{color}"/>')
        if highlight:
            rpr.append(f'<w:highlight w:val="{highlight}"/>')
        
        rpr_str = f"<w:rPr>{''.join(rpr)}</w:rPr>" if rpr else ""
        p_elements.append(f'<w:p><w:r>{rpr_str}<w:t xml:space="preserve">{escaped}</w:t></w:r></w:p>')

    doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(p_elements)}
  </w:body>
</w:document>'''

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/document.xml', doc_xml)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python build_docx.py <input_json> <output_docx>")
        sys.exit(1)
    
    input_json = sys.argv[1]
    output_docx = sys.argv[2]

    with open(input_json, 'r', encoding='utf-8') as f:
        paragraphs = json.load(f)
    
    build_docx(paragraphs, output_docx)
    print(f"Successfully generated: {output_docx} ({os.path.getsize(output_docx)} bytes)")
