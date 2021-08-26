package com.company;

import org.jnativehook.GlobalScreen;
import org.jnativehook.NativeHookException;
import org.jnativehook.keyboard.NativeKeyEvent;
import org.jnativehook.keyboard.NativeKeyListener;

public class KeyListener implements NativeKeyListener, Listener {
    public void nativeKeyPressed(NativeKeyEvent e) {}
    public void nativeKeyReleased(NativeKeyEvent e) {}
    public void nativeKeyTyped(NativeKeyEvent e) {

    }
    public void hook() {
        try {
            GlobalScreen.registerNativeHook();
        }
        catch (NativeHookException ex) {
            System.out.println("Cannot register native hook");
            System.exit(1);
        }
        GlobalScreen.addNativeKeyListener(this);
    }
    public void unhook() {
        GlobalScreen.removeNativeKeyListener(this);
    }
}
