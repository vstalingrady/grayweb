from PIL import Image
import sys

def scale_image(image, new_width=60):
    (original_width, original_height) = image.size
    aspect_ratio = original_height / float(original_width)
    new_height = int(aspect_ratio * new_width * 0.5)
    new_image = image.resize((new_width, new_height))
    return new_image

def convert_to_grayscale(image):
    return image.convert("L")

def map_pixels_to_ascii_chars(image, range_width=None):
    pixels = image.getdata()
    ascii_str = ""
    # " ░▒▓█"
    chars = [" ", "░", "▒", "▓", "█"]
    chars.reverse()
    
    if range_width is None:
        range_width = 255 // len(chars) + 1

    for pixel_value in pixels:
        idx = pixel_value // range_width
        if idx >= len(chars):
            idx = len(chars) - 1
        ascii_str += chars[idx]
    return ascii_str

def convert_image_to_ascii(image_path, new_width=60):
    try:
        image = Image.open(image_path)
    except Exception as e:
        print(e)
        return
    
    image = convert_to_grayscale(image)
    image = scale_image(image, new_width)
    
    # Adjust range_width based on chars length
    # 256 / 10 = ~25
    
    ascii_str = map_pixels_to_ascii_chars(image)
    
    img_width = image.width
    ascii_str_len = len(ascii_str)
    ascii_img = ""
    
    for i in range(0, ascii_str_len, img_width):
        ascii_img += ascii_str[i:i+img_width] + "\n"
        
    return ascii_img

if __name__ == "__main__":
    image_path = "/home/ubuntu/gray/indonesia-map.avif"
    ascii_art = convert_image_to_ascii(image_path, new_width=100)
    print(ascii_art)
