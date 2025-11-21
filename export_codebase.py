import os

def is_text_file(filename):
    text_extensions = {
        '.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', 
        '.md', '.txt', '.py', '.sql', '.env'
    }
    return any(filename.endswith(ext) for ext in text_extensions)

def export_codebase(src_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("# Codebase Export\n\n")
        
        for root, dirs, files in os.walk(src_dir):
            # Exclude node_modules and .git just in case, though we are targeting src
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if '.git' in dirs:
                dirs.remove('.git')
                
            for file in files:
                if is_text_file(file):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, start=os.path.dirname(src_dir))
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        out.write(f"## File: {relative_path}\n\n")
                        out.write("```" + (file.split('.')[-1] if '.' in file else '') + "\n")
                        out.write(content)
                        out.write("\n```\n\n")
                        print(f"Exported: {relative_path}")
                    except Exception as e:
                        print(f"Skipping {relative_path}: {e}")

if __name__ == "__main__":
    src_directory = "/Users/apcaballes/genieph/src"
    output_filename = "/Users/apcaballes/genieph/codebase_export.md"
    
    print(f"Starting export from {src_directory} to {output_filename}...")
    export_codebase(src_directory, output_filename)
    print("Export complete.")
