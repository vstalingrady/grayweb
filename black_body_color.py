
import math
import sys

def kelvin_to_rgb(temperature):
    """
    Converts a color temperature in Kelvin to an RGB color.
    Based on an algorithm by Tanner Helland.
    Accuracy is best between 1000K and 40000K.

    Args:
        temperature (float): The color temperature in Kelvin.

    Returns:
        tuple: A tuple (R, G, B) where each component is an integer
               between 0 and 255.
    """
    temp = temperature / 100.0

    # Calculate Red
    if temp <= 66:
        red = 255
    else:
        red = temp - 60
        red = 329.698727446 * (red ** -0.1332047592)
        red = max(0, min(255, red))

    # Calculate Green
    if temp <= 66:
        green = temp
        green = 99.4708025861 * math.log(green) - 161.1195681661
        green = max(0, min(255, green))
    else:
        green = temp - 60
        green = 288.1221695283 * (green ** -0.0755148492)
        green = max(0, min(255, green))

    # Calculate Blue
    if temp >= 66:
        blue = 255
    elif temp <= 19:
        blue = 0
    else:
        blue = temp - 10
        blue = 138.5177312231 * math.log(blue) - 305.0447927307
        blue = max(0, min(255, blue))

    return (int(red), int(green), int(blue))

def rgb_to_hex(rgb):
    """
    Converts an RGB tuple to a HEX string.
    """
    return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python black_body_color.py <temperature_in_kelvin>")
        sys.exit(1)

    try:
        kelvin = float(sys.argv[1])
        if kelvin < 1000 or kelvin > 40000:
            print("Warning: Temperature is outside the optimal range of 1000K to 40000K.")

        rgb = kelvin_to_rgb(kelvin)
        hex_color = rgb_to_hex(rgb)

        print(f"Temperature: {kelvin}K")
        print(f"RGB: {rgb}")
        print(f"HEX: {hex_color}")

    except ValueError:
        print("Error: Invalid temperature. Please provide a number.")
        sys.exit(1)
