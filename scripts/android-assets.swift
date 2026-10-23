// ============================================================
// Löwenherz — Android-Bitmaps aus dem Designer-Icon erzeugen
// ============================================================
//
//   swift scripts/android-assets.swift
//
// Quelle: scripts/android-assets/icon-1254.png (Designer-Icon, goldener
// Löwe auf Petrol, ohne Alphakanal). Daraus entstehen ALLE Android-Bitmaps
// in android/app/src/main/res/ — nie von Hand nachbearbeiten, sondern
// dieses Skript erneut laufen lassen:
//
//   mipmap-*/ic_launcher.png             Launcher-Icon für Android 7 (API 24/25)
//   mipmap-*/ic_launcher_round.png       rundes Launcher-Icon (API 25)
//   mipmap-*/ic_launcher_foreground.png  Adaptive-Icon-Vordergrund (API 26+),
//                                        Hintergrund = @color/ic_launcher_background
//   drawable-*/ic_stat_onesignal_default.png
//                                        Benachrichtigungs-Symbol: weiße Löwen-
//                                        Silhouette MIT Alphakanal. Android wertet
//                                        nur den Alphakanal aus — das vollfarbige
//                                        Icon ergab in der TWA ein gefülltes Quadrat.
//   drawable-xxxhdpi/ic_onesignal_large_icon_default.png
//                                        großes Bild rechts in der Benachrichtigung
//   drawable*/splash.png                 Startbildschirm des SplashScreen-Plugins:
//                                        Petrol, Löwe mittig (CENTER_CROP)
//
// Warum CoreGraphics statt ImageMagick/PIL: auf dem Mac immer vorhanden,
// keine Installation nötig.
// ============================================================

import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let scriptURL = URL(fileURLWithPath: #filePath).standardizedFileURL
let root = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
let srcPath = root.appendingPathComponent("scripts/android-assets/icon-1254.png").path
let res = root.appendingPathComponent("android/app/src/main/res")

let petrol = (r: 0x39, g: 0x82, b: 0x8b)
// Anteil des Löwen (Breite) am Designer-Icon — gemessen, damit die
// Größenangaben unten in „Löwenbreite" gedacht werden können.
let loewenAnteil = 0.51

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write(("[android-assets] FEHLER: " + msg + "\n").data(using: .utf8)!)
    exit(1)
}

func loadImage(_ path: String) -> CGImage {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fail("Quelle nicht lesbar: \(path)") }
    return img
}

func makeContext(_ w: Int, _ h: Int) -> CGContext {
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fail("Kein Kontext") }
    ctx.interpolationQuality = .high
    return ctx
}

func save(_ img: CGImage, _ relPath: String) {
    let url = res.appendingPathComponent(relPath)
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { fail("Ziel: \(relPath)") }
    CGImageDestinationAddImage(dest, img, nil)
    if !CGImageDestinationFinalize(dest) { fail("Schreiben: \(relPath)") }
    print("  \(relPath)  \(img.width)×\(img.height)")
}

func fillPetrol(_ ctx: CGContext, _ w: Int, _ h: Int) {
    ctx.setFillColor(red: CGFloat(petrol.r) / 255, green: CGFloat(petrol.g) / 255, blue: CGFloat(petrol.b) / 255, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
}

/// Designer-Icon zentriert auf eine Petrol-Fläche zeichnen; `iconBreite` in px.
func petrolMitLoewe(w: Int, h: Int, iconBreite: Double, icon: CGImage) -> CGImage {
    let ctx = makeContext(w, h)
    fillPetrol(ctx, w, h)
    let x = (Double(w) - iconBreite) / 2, y = (Double(h) - iconBreite) / 2
    ctx.draw(icon, in: CGRect(x: x, y: y, width: iconBreite, height: iconBreite))
    return ctx.makeImage()!
}

/// Weiße Silhouette: Alpha = „wie golden ist der Pixel" (Rotkanal zwischen
/// Petrol und Gold linear). Kanten bleiben dadurch weich.
func silhouette(_ icon: CGImage) -> CGImage {
    let w = icon.width, h = icon.height
    let ctx = makeContext(w, h)
    ctx.draw(icon, in: CGRect(x: 0, y: 0, width: w, height: h))
    guard let data = ctx.data else { fail("Pixeldaten") }
    let p = data.bindMemory(to: UInt8.self, capacity: w * h * 4)
    var maxR = 0
    for i in stride(from: 0, to: w * h * 4, by: 4) { maxR = max(maxR, Int(p[i])) }
    let bgR = Int(p[(2 * w + 2) * 4])        // Hintergrund = Pixel (2,2)
    if maxR - bgR < 60 { fail("Gold und Petrol zu ähnlich — Quelle prüfen") }
    for i in stride(from: 0, to: w * h * 4, by: 4) {
        let a = max(0, min(255, (Int(p[i]) - bgR) * 255 / (maxR - bgR)))
        p[i] = UInt8(a); p[i + 1] = UInt8(a); p[i + 2] = UInt8(a); p[i + 3] = UInt8(a)   // weiß, premultiplied
    }
    return ctx.makeImage()!
}

/// Rechteck mit Alpha > Schwelle (für das Zuschneiden der Silhouette).
func inhaltsRechteck(_ img: CGImage) -> CGRect {
    let w = img.width, h = img.height
    let ctx = makeContext(w, h)
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    let p = ctx.data!.bindMemory(to: UInt8.self, capacity: w * h * 4)
    var minX = w, minY = h, maxX = 0, maxY = 0
    for y in 0..<h { for x in 0..<w where p[(y * w + x) * 4 + 3] > 12 {
        minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
    } }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

func skaliert(_ img: CGImage, _ w: Int, _ h: Int) -> CGImage {
    let ctx = makeContext(w, h)
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    return ctx.makeImage()!
}

let icon = loadImage(srcPath)
if icon.width != icon.height { fail("Quelle muss quadratisch sein") }
print("[android-assets] Quelle \(icon.width)×\(icon.height), Ziel \(res.path)")

let dichten: [(String, Double)] = [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]

// 1) Launcher-Icons
for (name, d) in dichten {
    let px48 = Int(48 * d), px108 = Int(108 * d)
    // Legacy (Android 7): das Designer-Icon als Quadrat, wie in der TWA.
    save(skaliert(icon, px48, px48), "mipmap-\(name)/ic_launcher.png")
    // Rund (API 25): Icon leicht vergrößert, auf Kreis beschnitten — der Löwe
    // füllt den Kreis dann so wie die sichtbare Fläche des Adaptive Icons.
    do {
        let ctx = makeContext(px48, px48)
        ctx.addEllipse(in: CGRect(x: 0, y: 0, width: px48, height: px48)); ctx.clip()
        let s = Double(px48) * 1.25, o = (Double(px48) - s) / 2
        ctx.draw(icon, in: CGRect(x: o, y: o, width: s, height: s))
        save(ctx.makeImage()!, "mipmap-\(name)/ic_launcher_round.png")
    }
    // Adaptive-Vordergrund: 108dp-Leinwand, sichtbar sind die inneren 72dp.
    // Icon auf 83 % gezeichnet → Löwe ≈ 46dp, sicher innerhalb des 66dp-Kreises;
    // der Petrol-Rand des Icons verschmilzt mit der Petrol-Hintergrundebene.
    save(petrolMitLoewe(w: px108, h: px108, iconBreite: Double(px108) * 0.83, icon: icon),
         "mipmap-\(name)/ic_launcher_foreground.png")
}

// 2) Benachrichtigungs-Symbol (24dp) — Silhouette in die Leinwand eingepasst,
//    1dp Rand ringsum, damit nichts an der Kante klebt.
let silu = silhouette(icon)
let box = inhaltsRechteck(silu)
let ausschnitt = silu.cropping(to: box)!
for (name, d) in dichten {
    let px = Int(24 * d)
    let ctx = makeContext(px, px)
    let innen = Double(px) - 2 * d
    let scale = innen / Double(max(box.width, box.height))
    let w = Double(box.width) * scale, h = Double(box.height) * scale
    ctx.draw(ausschnitt, in: CGRect(x: (Double(px) - w) / 2, y: (Double(px) - h) / 2, width: w, height: h))
    save(ctx.makeImage()!, "drawable-\(name)/ic_stat_onesignal_default.png")
}

// 3) Großes Bild in der Benachrichtigung (wie chrome_web_icon in der TWA).
save(skaliert(icon, 256, 256), "drawable-xxxhdpi/ic_onesignal_large_icon_default.png")

// 4) Splash: 9:20-Leinwand je Dichte (Hochformat 360×800dp, Querformat
//    gespiegelt) plus ein quadratischer Fallback. Löwe 120dp breit, mittig —
//    so groß wie das Symbol des Android-12-Systemsplashs, der direkt davor
//    erscheint. CENTER_CROP in capacitor.config.json lässt den Rand abschneiden
//    statt zu verzerren; abgeschnitten wird nur Petrol.
let loewenBreiteDp = 120.0
for (name, d) in dichten {
    let iconBreite = loewenBreiteDp / loewenAnteil * d
    save(petrolMitLoewe(w: Int(360 * d), h: Int(800 * d), iconBreite: iconBreite, icon: icon), "drawable-port-\(name)/splash.png")
    save(petrolMitLoewe(w: Int(800 * d), h: Int(360 * d), iconBreite: iconBreite, icon: icon), "drawable-land-\(name)/splash.png")
}
save(petrolMitLoewe(w: 1200, h: 1200, iconBreite: loewenBreiteDp / loewenAnteil * 3, icon: icon), "drawable/splash.png")
print("[android-assets] OK")
