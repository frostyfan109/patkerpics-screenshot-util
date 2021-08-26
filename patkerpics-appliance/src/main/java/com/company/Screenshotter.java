package com.company;

import org.jnativehook.mouse.NativeMouseEvent;

import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import com.sun.jna.Native;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.platform.win32.WinNT;
import com.sun.jna.platform.win32.WinGDI;
import com.sun.jna.win32.W32APIOptions;

interface Callback {
    public void run(BufferedImage capture);
}

public class Screenshotter extends JWindow {
    private Callback callback;
    private JPanel screenshotRegion = new JPanel();
    private MouseListener listener = new MouseListener() {
        @Override
        public void nativeMousePressed(NativeMouseEvent e) {
            screenshotRegion.setLocation(getLocation());
        }
        @Override
        public void nativeMouseReleased(NativeMouseEvent e) {
            setVisible(false);
            try {
                callback.run(takeScreenshot());
            }
            catch (AWTException exc) {}
            abort();
        }
        @Override
        public void nativeMouseDragged(NativeMouseEvent e) {
            Point location = getLocation();
            updateScreenshotLocation(location);
        }
    };
    public Screenshotter() {
        super();
        setBackground(new Color(0, 0, 0, 1));
        screenshotRegion.setBackground(new Color(0, 0, 0, 0));
        setLocation(0, 0);
        screenshotRegion.setBorder(BorderFactory.createDashedBorder(Color.black, 5, 3));
        rootPane.add(screenshotRegion);
        setAlwaysOnTop(true);
    }
    private void updateScreenshotLocation(Point location) {
        int cursorX = (int)(location.getX() - screenshotRegion.getX());
        int cursorY = (int)(location.getY() - screenshotRegion.getY());
        screenshotRegion.setSize(
                cursorX,
                cursorY
        );
    }
    private BufferedImage takeScreenshot() throws AWTException {
        Rectangle captureArea = screenshotRegion.getBounds();
        if (captureArea.width == 0 && captureArea.height == 0) return null;
        DisplayMode display = GraphicsEnvironment.getLocalGraphicsEnvironment().getDefaultScreenDevice().getDisplayMode();
        double scaleWidth = ((double)display.getWidth() / (double)getWidth());
        double scaleHeight = ((double)display.getHeight() / (double)getHeight());
        captureArea.setLocation(
                (int)(captureArea.getX() * scaleWidth),
                (int)(captureArea.getY() * scaleHeight)
        );
        captureArea.setSize(
                (int)(captureArea.getWidth() * scaleWidth),
                (int)(captureArea.getHeight() * scaleHeight)
        );

        long initial = System.currentTimeMillis();
        BufferedImage capture = JNAScreenshot.getScreenshot(captureArea);
        return capture;
//        File file = new File("test.png");
//        try {
//            ImageIO.write(capture, "PNG", file);
//            Desktop.getDesktop().open(file);
//        }
//        catch (IOException exc) {}

    }
    public void abort() {
        listener.unhook();
        callback = null;
        setCursor(new Cursor(Cursor.DEFAULT_CURSOR));
        setVisible(false);
    }
    public void screenshot(Callback callback) {
        setCursor(new Cursor(Cursor.CROSSHAIR_CURSOR));
        Toolkit toolkit = Toolkit.getDefaultToolkit();
        setSize(toolkit.getScreenSize());
        screenshotRegion.setSize(0,0);
        listener.hook();
        this.callback = callback;
        setVisible(true);
    }
}
