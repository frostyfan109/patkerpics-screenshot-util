package com.company;

import org.jnativehook.GlobalScreen;
import org.jnativehook.NativeHookException;
import org.jnativehook.mouse.NativeMouseEvent;
import org.jnativehook.mouse.NativeMouseInputListener;

import java.awt.*;

public class MouseListener implements NativeMouseInputListener, Listener {
    public void hook() {
        try {
            GlobalScreen.registerNativeHook();
        }
        catch (NativeHookException ex) {
            System.out.println("Cannot register native hook");
            System.exit(1);
        }
        GlobalScreen.addNativeMouseListener(this);
        GlobalScreen.addNativeMouseMotionListener(this);
    }
    public void unhook() {
        GlobalScreen.removeNativeMouseListener(this);
        GlobalScreen.removeNativeMouseMotionListener(this);
    }
    public static Point getLocation() {
        return MouseInfo.getPointerInfo().getLocation();
    }

    public void nativeMouseClicked(NativeMouseEvent nativeMouseEvent) {

    }

    public void nativeMousePressed(NativeMouseEvent nativeMouseEvent) {

    }

    public void nativeMouseReleased(NativeMouseEvent nativeMouseEvent) {

    }

    public void nativeMouseMoved(NativeMouseEvent nativeMouseEvent) {

    }

    @Override
    public void nativeMouseDragged(NativeMouseEvent nativeMouseEvent) {

    }
}