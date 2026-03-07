# Android APK 编译与打包说明（中文）

本文档用于记录 `robot_viewer` 项目的 Android 编译流程，包含环境准备、签名打包、安装验证及常见问题处理。

## 1. 适用范围

- 项目类型：Vite + Capacitor（Android）
- 操作系统：Windows
- 包管理器：pnpm

## 2. 目录与产物说明

- Android 工程目录：`android/`
- Debug 包输出：`android/app/build/outputs/apk/debug/app-debug.apk`
- Release 包输出：`android/app/build/outputs/apk/release/app-release.apk`

## 3. 一次性环境准备

### 3.1 安装 Node.js 与 pnpm

确保可用：

```bash
node -v
pnpm -v
```

### 3.2 安装 JDK 21（推荐）

当前 Android 构建链路需要 JDK 21，建议安装 Temurin 21。

验证：

```bash
java -version
```

### 3.3 配置 Android SDK

确保 Android SDK 目录存在（示例）：

- `C:\dev\Android\Sdk`

配置环境变量（用户级）：

- `ANDROID_HOME=C:\dev\Android\Sdk`
- `ANDROID_SDK_ROOT=C:\dev\Android\Sdk`

并在项目内配置 `android/local.properties`：

```properties
sdk.dir=C:/dev/Android/Sdk
```

### 3.4 代理配置（如你网络需要代理）

Gradle 使用用户目录下的配置：

- `C:\Users\<你的用户名>\.gradle\gradle.properties`

示例（本地代理 7897）：

```properties
systemProp.http.proxyHost=127.0.0.1
systemProp.http.proxyPort=7897
systemProp.https.proxyHost=127.0.0.1
systemProp.https.proxyPort=7897
```

## 4. 项目初始化（首次）

在项目根目录执行：

```bash
pnpm install
pnpm run android:add
```

> `android:add` 只需要首次执行一次。

## 5. 日常编译命令

### 5.1 同步 Web 资源到 Android

```bash
pnpm run android:sync
```

该命令会自动：

1. 执行 `vite build`
2. 执行 `npx cap sync android`

### 5.2 生成 Debug APK

```bash
pnpm run android:apk:debug
```

### 5.3 生成 Release APK

```bash
pnpm run android:apk:release
```

## 6. Release 签名配置（必须）

如果未签名，安装时会报“APK 不包含任何证书”。

### 6.1 生成 keystore（仅首次）

在项目根目录执行：

```bash
keytool -genkeypair -v -keystore android/app/upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

### 6.2 配置 `android/key.properties`

创建文件 `android/key.properties`：

```properties
storeFile=upload-keystore.jks
storePassword=你的store密码
keyAlias=upload
keyPassword=你的key密码
```

说明：

- `storeFile` 是相对于 `android/app` 模块目录的路径。
- 因此推荐写 `upload-keystore.jks`（对应 `android/app/upload-keystore.jks`）。

### 6.3 重新打包

```bash
pnpm run android:apk:release
```

## 7. 安装到手机

方式一：手动拷贝 `app-release.apk` 到手机安装。

方式二：使用 adb（可选）：

```bash
adb devices
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## 8. 状态栏隐藏说明

当前项目已经在 Android 原生层做了状态栏隐藏处理（`MainActivity` + 主题配置）。

如果你改了主题或 Activity，状态栏可能重新出现，请检查：

- `android/app/src/main/java/com/robotsfan/robotviewer/MainActivity.java`
- `android/app/src/main/res/values/styles.xml`

## 9. 常见问题排查

### 9.1 `JAVA_HOME is not set` / 找不到 `java`

- 安装 JDK 21
- 重新打开终端
- 确认 `java -version` 可用

### 9.2 `SDK location not found`

- 检查 `ANDROID_HOME` / `ANDROID_SDK_ROOT`
- 检查 `android/local.properties` 的 `sdk.dir`

### 9.3 `无效的源发行版：21`

- 表示 JDK 版本过低
- 切换到 JDK 21

### 9.4 `apk 不包含任何证书`

- 未配置签名或签名路径错误
- 检查 `android/key.properties` 与 keystore 文件

### 9.5 `Keystore file ... not found`

- `storeFile` 写错了相对路径
- 推荐：`storeFile=upload-keystore.jks`

### 9.6 Gradle 下载/依赖下载失败

- 检查代理端口是否可用（如 `127.0.0.1:7897`）
- 检查 `~/.gradle/gradle.properties` 代理配置

## 10. 推荐的下次编译最短流程

每次只需要：

```bash
pnpm run android:apk:release
```

如果签名、JDK、SDK、代理均已配置好，这条命令即可直接产出可安装的 release APK。
