package com.robotsfan.robotviewer;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

@CapacitorPlugin(name = "AndroidFolderPicker")
public class AndroidFolderPickerPlugin extends Plugin {

	@PluginMethod
	public void pickFolder(PluginCall call) {
		Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
		intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
		startActivityForResult(call, intent, "handlePickFolderResult");
	}

	@ActivityCallback
	private void handlePickFolderResult(PluginCall call, ActivityResult result) {
		if (call == null) {
			return;
		}

		if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
			JSObject ret = new JSObject();
			ret.put("cancelled", true);
			call.resolve(ret);
			return;
		}

		Uri treeUri = result.getData().getData();
		if (treeUri == null) {
			call.reject("No folder selected");
			return;
		}

		int takeFlags = result.getData().getFlags() &
			(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
		try {
			getContext().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
		} catch (SecurityException ignored) {
		}

		DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
		if (root == null || !root.isDirectory()) {
			call.reject("Selected URI is not a directory");
			return;
		}

		JSArray files = new JSArray();
		try {
			File importRoot = new File(getContext().getCacheDir(), "folder-import/" + System.currentTimeMillis());
			if (!importRoot.exists() && !importRoot.mkdirs()) {
				call.reject("Failed to create import cache directory");
				return;
			}
			collectFiles(root, "", files, importRoot);
		} catch (IOException e) {
			call.reject("Failed to read folder: " + e.getMessage());
			return;
		}

		JSObject ret = new JSObject();
		ret.put("cancelled", false);
		ret.put("rootName", root.getName() != null ? root.getName() : "folder");
		ret.put("files", files);
		call.resolve(ret);
	}

	private void collectFiles(DocumentFile directory, String relativeDir, JSArray output, File importRoot) throws IOException {
		DocumentFile[] children = directory.listFiles();
		for (DocumentFile child : children) {
			String name = child.getName();
			if (name == null) {
				continue;
			}

			String relativePath = relativeDir.isEmpty() ? name : relativeDir + "/" + name;

			if (child.isDirectory()) {
				collectFiles(child, relativePath, output, importRoot);
			} else if (child.isFile()) {
				File localFile = new File(importRoot, relativePath);
				File parentDir = localFile.getParentFile();
				if (parentDir != null && !parentDir.exists() && !parentDir.mkdirs()) {
					throw new IOException("Cannot create directory: " + parentDir.getAbsolutePath());
				}

				copyUriToFile(child.getUri(), localFile);

				JSObject item = new JSObject();
				item.put("name", name);
				item.put("relativePath", relativePath);
				item.put("size", child.length());
				item.put("mimeType", child.getType() != null ? child.getType() : "application/octet-stream");
				item.put("localPath", localFile.getAbsolutePath());
				output.put(item);
			}
		}
	}

	private void copyUriToFile(Uri uri, File outputFile) throws IOException {
		InputStream inputStream = getContext().getContentResolver().openInputStream(uri);
		if (inputStream == null) {
			throw new IOException("Cannot open input stream for " + uri);
		}

		try (InputStream in = inputStream; FileOutputStream out = new FileOutputStream(outputFile)) {
			byte[] buffer = new byte[8192];
			int read;
			while ((read = in.read(buffer)) != -1) {
				out.write(buffer, 0, read);
			}
		}
	}
}
