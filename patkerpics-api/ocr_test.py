import numpy as np
import pytesseract
import cv2
from pytesseract import Output
im = cv2.imread("images/2/text.png")
text = pytesseract.image_to_string(im).strip()
boxes = pytesseract.image_to_boxes(im).splitlines()

boxed_words = []
boxed_word = None
i = 0
for n, char in enumerate(text):
    if char == " ":
        boxed_words.append(boxed_word)
        boxed_word = None
        continue
    symbol, left, bottom, right, top, _ = boxes[i].split()
    if char != symbol:
        # Not really sure why some characters don't get bounding boxes
        print("skip")
        continue
    if boxed_word is None:
        # First char in word
        boxed_word = {
            "top": top,
            "left": left,
            "bottom": bottom,
            "chars": []
        }
    elif len(text) == n+1 or text[n+1] == " ":
        # Last char in word
        boxed_word["right"] = right

    boxed_word["chars"].append(char)
            
    i += 1

print(boxed_words[0])
print(len([box for box in boxed_words if box.get("right") is None]))
print(len(boxed_words))

for box in boxed_words:
    if box.get("right") is None: continue
    x = box["left"]
    y = box["top"]
    x2 = box["right"]
    y2 = box["bottom"]

    cv2.rectangle(im, (int(x), int(y)), (int(x2), int(y2)), (0, 0, 255), 1)

cv2.imshow("image", im)
cv2.waitKey(0)
