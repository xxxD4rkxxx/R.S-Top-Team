
import os
import re

def check_usestate_imports():
    src_dir = r'g:\Programação\Academy 2\src'
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.jsx', '.js')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                        # Check if useState is used
                        if re.search(r'\buseState\(', content):
                            # Check if it's imported or used as React.useState
                            if not re.search(r'import.*useState.*\bfrom\s+[\'"]react[\'"]', content) and \
                               not re.search(r'\bReact\.useState\(', content):
                                print(f"POTENTIAL ERROR IN: {path}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    check_usestate_imports()
