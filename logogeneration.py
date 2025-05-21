import os
from PIL import Image

def resize_icon(input_path, output_path, size):
    """Resize an image to the specified size and save it"""
    try:
        # Open the original image
        img = Image.open(input_path)
        
        # Resize the image (preserving aspect ratio)
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save the resized image
        img.save(output_path)
        print(f"Created {output_path} ({size}x{size})")
        
        return True
    except Exception as e:
        print(f"Error creating {output_path}: {e}")
        return False

def main():
    # Use the specific file path provided
    input_file = r"C:\Users\Christian Okeke\EQ\EQ-Translator\images\logomain.png"
    
    # Define the images directory (same directory as the input file)
    images_dir = os.path.dirname(input_file)
    
    # Define icon sizes
    icon_sizes = [16, 48, 128]
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        return
    
    print(f"Found source logo: {input_file}")
    
    # Resize for each required size
    for size in icon_sizes:
        output_file = os.path.join(images_dir, f"icon{size}.png")
        resize_icon(input_file, output_file, size)
    
    print("\nAll icons created! The icons have been saved to:")
    print(images_dir)
    print("\nMake sure your manifest.json references these icons correctly:")
    print('"icons": {')
    print('  "16": "images/icon16.png",')
    print('  "48": "images/icon48.png",')
    print('  "128": "images/icon128.png"')
    print('}')

if __name__ == "__main__":
    main()