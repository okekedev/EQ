#!/usr/bin/env python3
"""
Chrome Extension Icon Generator
Converts logomain.png to required icon sizes (16x16, 48x48, 128x128)
"""

from PIL import Image, ImageFilter
import os
import sys

def create_icon_sizes(input_path, output_dir="images"):
    """
    Generate Chrome extension icons from a source image
    
    Args:
        input_path (str): Path to the source image (logomain.png)
        output_dir (str): Directory to save the generated icons
    """
    
    # Required icon sizes for Chrome extensions
    sizes = {
        "icon16.png": 16,
        "icon48.png": 48,
        "icon128.png": 128
    }
    
    try:
        # Open the source image
        print(f"📁 Opening source image: {input_path}")
        source_image = Image.open(input_path)
        
        # Convert to RGBA if not already (ensures transparency support)
        if source_image.mode != 'RGBA':
            print("🔄 Converting to RGBA format for transparency support...")
            source_image = source_image.convert('RGBA')
        
        print(f"✅ Source image loaded: {source_image.size[0]}x{source_image.size[1]} pixels")
        
        # Create output directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"📂 Created output directory: {output_dir}")
        
        # Generate each icon size
        for filename, size in sizes.items():
            output_path = os.path.join(output_dir, filename)
            
            print(f"🎨 Generating {filename} ({size}x{size})...")
            
            # Resize image with high-quality resampling
            # Use LANCZOS for high-quality downsampling
            resized_image = source_image.resize((size, size), Image.Resampling.LANCZOS)
            
            # For very small icons (16px), apply slight sharpening to improve clarity
            if size == 16:
                print("   ✨ Applying sharpening filter for 16px icon...")
                resized_image = resized_image.filter(ImageFilter.UnsharpMask(radius=0.5, percent=120, threshold=2))
            
            # Save the resized icon
            resized_image.save(output_path, 'PNG', optimize=True)
            
            # Verify the saved file
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                print(f"   ✅ Saved: {output_path} ({file_size} bytes)")
            else:
                print(f"   ❌ Failed to save: {output_path}")
        
        print("\n🎉 Icon generation complete!")
        print(f"📁 All icons saved in: {os.path.abspath(output_dir)}")
        
        # List generated files
        print("\n📋 Generated files:")
        for filename in sizes.keys():
            file_path = os.path.join(output_dir, filename)
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                print(f"   • {filename} - {file_size} bytes")
        
        print("\n💡 Tips for best results:")
        print("   • Use a square logo with transparent background")
        print("   • Ensure your logo is at least 128x128 pixels")
        print("   • Simple, bold designs work best for small icons")
        print("   • Test the 16px icon to ensure it's still recognizable")
        
    except FileNotFoundError:
        print(f"❌ Error: Could not find '{input_path}'")
        print("💡 Make sure 'logomain.png' is in the same directory as this script")
        return False
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    
    return True

def optimize_for_extension(image_path):
    """
    Additional optimization tips for extension icons
    """
    try:
        img = Image.open(image_path)
        
        # Check if image is square
        if img.size[0] != img.size[1]:
            print("⚠️  Warning: Source image is not square!")
            print("   Consider cropping to square aspect ratio for best results")
        
        # Check resolution
        min_size = min(img.size)
        if min_size < 128:
            print(f"⚠️  Warning: Source image is small ({min_size}px)")
            print("   For best quality, use an image at least 128x128 pixels")
        
        # Check for transparency
        if img.mode == 'RGBA':
            print("✅ Image has transparency support")
        else:
            print("ℹ️  Image will be converted to support transparency")
            
    except Exception as e:
        print(f"⚠️  Could not analyze image: {e}")

def main():
    """Main function"""
    print("🎨 Chrome Extension Icon Generator")
    print("=" * 40)
    
    # Default input file
    input_file = "logomain.png"
    
    # Check if custom input file is provided
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"❌ Error: '{input_file}' not found!")
        print("\n💡 Usage:")
        print("   python icon_generator.py [input_file]")
        print("   python icon_generator.py logomain.png")
        print("\n📁 Make sure your logo file is in the current directory")
        return
    
    # Analyze the source image
    print(f"\n🔍 Analyzing source image: {input_file}")
    optimize_for_extension(input_file)
    
    print(f"\n🚀 Generating icons from: {input_file}")
    
    # Generate the icons
    success = create_icon_sizes(input_file)
    
    if success:
        print("\n🎯 Next steps:")
        print("   1. Copy the generated icons to your extension's 'images' folder")
        print("   2. Update your manifest.json to reference these icons")
        print("   3. Test your extension to ensure icons display correctly")
        print("\n📝 Your manifest.json should include:")
        print('   "icons": {')
        print('     "16": "images/icon16.png",')
        print('     "48": "images/icon48.png",')
        print('     "128": "images/icon128.png"')
        print('   }')
    else:
        print("\n❌ Icon generation failed!")

if __name__ == "__main__":
    main()