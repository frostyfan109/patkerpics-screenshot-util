package com.company;

import org.jnativehook.GlobalScreen;
import org.jnativehook.keyboard.NativeKeyEvent;

import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.util.logging.Level;
import java.util.logging.Logger;

public class Main {
    public static boolean run = true;
    public static void main(String[] args) throws InterruptedException {
        Logger.getLogger(GlobalScreen.class.getPackage().getName()).setLevel(Level.OFF);

        JNAScreenshot.prepare();

        SwingUtilities.invokeLater(new Runnable() {
            public void run() {
                Screenshotter screenshotter = new Screenshotter();

                KeyListener screenshotListener = new KeyListener() {
                    @Override
                    public void nativeKeyPressed(NativeKeyEvent event) {
                        if (
                                event.getKeyCode() == NativeKeyEvent.VC_Q &&
                                        (event.getModifiers() == NativeKeyEvent.CTRL_MASK ||
                                                event.getModifiers() == NativeKeyEvent.CTRL_L_MASK ||
                                                event.getModifiers() == NativeKeyEvent.CTRL_R_MASK)
                        ) {
                            screenshotter.screenshot((BufferedImage capture) -> {

                            });
                        }
                        else if (event.getKeyCode() == NativeKeyEvent.VC_ESCAPE) {
                            screenshotter.abort();
                        }
                    }
                };
                screenshotListener.hook();
            }
        });

    }
}
