"""Camera preview, hand overlay and wrist-following props using Tkinter."""
import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
from example_usage import InputSource, handle_detected_actions, parse_options
from python_view import hand_lines, visible_points, wrists
from python_view import COLORS, grid_lines, prop_points, viewport


class Application:
    def __init__(self, root, options):
        self.root = root
        self.options = options
        self.closed = False
        self.source = InputSource(options)
        self.photo = None
        self.error = None
        root.title("MIG - import a profile" if options.profile_mode else "MIG - raise either hand")
        if options.profile_mode:
            tk.Button(root, text="Import profile…", command=self.import_profile).pack(fill="x")
        self.status = tk.StringVar(value="Import a JSON profile, then keep shoulders visible."
                                   if options.profile_mode else
                                   "Keep shoulders visible, lower your hands, then raise either hand.")
        tk.Label(root, textvariable=self.status, wraplength=780).pack(fill="x")
        self.canvas = tk.Canvas(root, width=800, height=600, background="#191b20")
        self.canvas.pack(fill="both", expand=True)
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.after(20, self.tick)

    def import_profile(self):
        path = filedialog.askopenfilename(parent=self.root, filetypes=[("MIG profile", "*.json")])
        if path:
            self.source.import_profile(path)

    def draw_camera(self, image, view):
        self.canvas.delete("camera")
        if image is None:
            return
        width, height, pixels = image
        picture = Image.frombytes("RGB", (width, height), pixels)
        picture = picture.transpose(getattr(Image, "Transpose", Image).FLIP_LEFT_RIGHT)
        x, y, w, h = view
        picture = picture.resize((max(1, int(w)), max(1, int(h))),
                                 getattr(Image, "Resampling", Image).BILINEAR)
        self.photo = ImageTk.PhotoImage(picture)
        self.canvas.create_image(x, y, image=self.photo, anchor="nw", tags="camera")
        self.canvas.tag_lower("camera")

    def draw_frame(self, packet, image):
        self.canvas.delete("overlay")
        aspect = image[0] / image[1] if image else packet.aspect if packet else 4 / 3
        x, y, w, h = viewport(self.canvas.winfo_width(), self.canvas.winfo_height(), aspect)
        self.draw_camera(image, (x, y, w, h))
        for row, points in (() if self.options.profile_mode else grid_lines(packet)):
            coordinates = [value for px, py in points for value in (x + px * w, y + py * h)]
            self.canvas.create_polygon(coordinates, fill="", outline="#ffd23c" if row == 1 else "#46d7a0",
                                       width=2, tags="overlay")
        for px, py in visible_points(packet):
            px, py = x + px * w, y + py * h
            self.canvas.create_oval(px - 3, py - 3, px + 3, py + 3, fill="#46d7a0", tags="overlay")
        for a, b, c, d in hand_lines(packet):
            self.canvas.create_line(x + a * w, y + b * h, x + c * w, y + d * h,
                                    fill="#ffd23c", width=2, tags="overlay")
        for side, px, py in wrists(packet):
            px, py = x + px * w, y + py * h
            points = [value for pair in prop_points(px, py) for value in pair]
            self.canvas.create_polygon(points, fill=COLORS[side], outline="white", tags="overlay")
            self.canvas.create_text(px, py + 25, text=side, fill="white", tags="overlay")

    def tick(self):
        if notice := self.source.notice():
            self.status.set(notice)
        latest = self.source.take()
        if latest:
            packet, events, image, error = latest
            if error:
                self.status.set(error)
                print(error, flush=True)
                self.source.close()
                if self.options.smoke:
                    self.error = error
                    self.close()
                return
            self.draw_frame(packet, image)
            if message := handle_detected_actions(events, self.options.profile_mode):
                self.status.set(message)
            if self.options.smoke and packet and packet.sequence >= 90:
                self.close()
                return
        if not self.closed:
            self.root.after(20, self.tick)

    def close(self):
        if not self.closed:
            self.closed = True
            self.source.close()
            self.root.destroy()


def run(profile_mode=False):
    options = parse_options(profile_mode)
    root = tk.Tk()
    application = Application(root, options)
    root.mainloop()
    if application.error:
        raise RuntimeError(application.error)
