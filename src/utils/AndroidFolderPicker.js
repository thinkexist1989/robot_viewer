import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const AndroidFolderPicker = registerPlugin('AndroidFolderPicker');

export function canUseAndroidNativeFolderPicker() {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
    return isAndroid && isNative;
}

export async function pickAndroidFolderFiles() {
    const result = await AndroidFolderPicker.pickFolder();
    if (!result || result.cancelled) {
        return [];
    }

    const files = [];
    const items = result.files || [];

    for (const item of items) {
        if (!item.localPath) {
            continue;
        }

        const webPath = Capacitor.convertFileSrc(item.localPath);
        const response = await fetch(webPath);
        if (!response.ok) {
            throw new Error(`Failed to read imported file: ${item.relativePath || item.name}`);
        }

        const blob = await response.blob();
        const file = new File([blob], item.name, {
            type: item.mimeType || 'application/octet-stream'
        });

        try {
            Object.defineProperty(file, 'webkitRelativePath', {
                value: item.relativePath || item.name,
                configurable: true
            });
        } catch (error) {
            file._relativePath = item.relativePath || item.name;
        }

        files.push(file);
    }

    return files;
}
