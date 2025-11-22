import os
import filecmp
import hashlib

def get_file_hash(filepath):
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def compare_directories(src_dir, target_dir):
    modified_files = []
    new_files = []
    
    # Walk through the source directory
    for root, dirs, files in os.walk(src_dir):
        # Get relative path from src_dir
        rel_path = os.path.relpath(root, src_dir)
        
        # Determine corresponding target directory
        target_root = os.path.join(target_dir, rel_path)
        if rel_path == '.':
            target_root = target_dir
            
        for file in files:
            src_file = os.path.join(root, file)
            target_file = os.path.join(target_root, file)
            
            # Skip .DS_Store and other hidden files if needed
            if file.startswith('.'):
                continue
                
            if os.path.exists(target_file):
                # Compare contents
                if get_file_hash(src_file) != get_file_hash(target_file):
                    modified_files.append(os.path.join(rel_path, file))
            else:
                new_files.append(os.path.join(rel_path, file))
                
    return modified_files, new_files

src_dir = '/Users/apcaballes/genieph/src'
target_dir = '/Users/apcaballes/genieph/nov-21---migration-fix'

modified, new = compare_directories(src_dir, target_dir)

print("MODIFIED FILES:")
for f in sorted(modified):
    print(f)

print("\nNEW FILES (Present in src but missing in nov-21):")
for f in sorted(new):
    print(f)
