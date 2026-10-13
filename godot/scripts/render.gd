extends Node2D
## Draws the world (pixel-snapped, feet anchored at the sprite's (56,100)) and the UI. Mirrors src/ui.js.

var game
var CELL := 144
var AX := 72
var AY := 128
const GW := 384
const GH := 216
const GOLD := Color("f2b630")
const GOLD2 := Color("ffd866")
const INK := Color("14091c")
const MAG := Color("d93aa0")
const CREAM := Color("f6ead0")
const DIM := Color("8f84a3")
const RED := Color("e0322e")

var sheets := {}
var portraits := {}
var bgs := {}
var props_tex := {}
var food_tex := {}
var fx := {}
var font: Font

func _tex(p: String) -> Texture2D:
  return load("res://" + p)

func _ready() -> void:
  texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
  var ff := FontFile.new()
  ff.data = FileAccess.get_file_as_bytes("res://assets/PressStart2P.woff2")
  ff.antialiasing = TextServer.FONT_ANTIALIASING_NONE
  ff.hinting = TextServer.HINTING_NONE
  font = ff
  var D = game.D
  CELL = int(D.cell)
  AX = int(D.anchor[0])
  AY = int(D.anchor[1])
  for id in D.players + D.enemies:
    sheets[id] = _tex("assets/sprites/%s.png" % id)
    portraits[id] = _tex("assets/sprites/%s_portrait.png" % id)
  for t in ["crate", "barrel", "bin", "boxes"]:
    props_tex[t] = _tex("assets/prop_%s.png" % t)
  for t in ["adana", "shish", "doner", "lahmacun", "kunefe", "spit", "empty"]:
    food_tex[t] = _tex("assets/food_%s.png" % t)
  for n in ["spark", "boom", "dust", "sparkle"]:
    fx[n] = [_tex("assets/fx_%s0.png" % n), _tex("assets/fx_%s1.png" % n), _tex("assets/fx_%s2.png" % n)]
  fx["ko"] = _tex("assets/fx_ko.png")
  fx["glow"] = _tex("assets/fx_glow.png")
  for i in D.STAGES.size():
    bgs[i] = [_tex("assets/bg/stage%d_far.png" % i), _tex("assets/bg/stage%d_mid.png" % i), _tex("assets/bg/stage%d_floor.png" % i)]

func _process(_dt: float) -> void:
  queue_redraw()

# ---------------------------------------------------------------- text helpers
func txt(s: String, x: float, y: float, size: int, col: Color, align := 0) -> void:
  var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
  var px := x
  if align == 1:
    px = x - w / 2.0
  elif align == 2:
    px = x - w
  draw_string_outline(font, Vector2(px, y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 3, INK)
  draw_string(font, Vector2(px, y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)

func box(x: float, y: float, w: float, h: float, fill: Color, border: Color, bw: float) -> void:
  draw_rect(Rect2(x - bw, y - bw, w + bw * 2, h + bw * 2), border)
  draw_rect(Rect2(x, y, w, h), fill)

func bar(x: float, y: float, w: float, h: float, pct: float, col: Color, back: Color) -> void:
  box(x, y, w, h, back, CREAM, 1)
  draw_rect(Rect2(x, y, w * maxf(0.0, pct), h), col)
  draw_rect(Rect2(x, y, w * maxf(0.0, pct), h * 0.3), Color(1, 1, 1, 0.25))
  for i in range(1, 10):
    draw_rect(Rect2(x + w * i / 10.0 - 0.5, y, 1, h), Color(0.08, 0.035, 0.11, 0.5))

# ---------------------------------------------------------------- sprites
func shadow(x: float, y: float, w: float, a: float) -> void:
  var rows := [0.55, 0.85, 1.0, 0.85, 0.55]
  for i in 5:
    var ww := roundf(w * rows[i])
    draw_rect(Rect2(x - floorf(ww / 2.0), y - 2 + i, ww, 1), Color(0.03, 0.016, 0.06, a))

func draw_fighter(e: Dictionary, ox: float, oy: float) -> void:
  var at: Dictionary = game.D.atlas[e.kitId]
  var a: Dictionary = at.get(e.anim, at.idle)
  var fr: int = mini(int(e.frame), int(a.n) - 1)
  var src := Rect2(fr * CELL, int(a.row) * CELL, CELL, CELL)
  var x := roundf(e.x - game.cam_x) + ox
  var y := roundf(e.y - e.z) + oy
  draw_set_transform(Vector2(x, y), 0.0, Vector2(-1 if e.face < 0 else 1, 1))
  var mod := Color(3, 3, 3, 1) if e.flash > 0 else Color(1, 1, 1, 1)
  draw_texture_rect_region(sheets[e.kitId], Rect2(-AX, -AY, CELL, CELL), src, mod)
  draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw() -> void:
  if game == null:
    return
  var s: String = game.state
  if s == "title" or s == "select":
    draw_title_bg()
  elif not game.stage.is_empty():
    draw_world()
  if s == "title":
    ui_title()
  elif s == "select":
    ui_select()
  elif s != "loading":
    ui_hud()
    if s == "pause":
      ui_pause()
    elif s == "gameover":
      ui_end("GAME OVER", RED, ["SCORE %07d" % game.score], "ENTER: CONTINUE   ESC: TITLE")
    elif s == "stageclear":
      ui_end("STAGE CLEAR", GOLD, [game.stage.name, "SCORE %07d" % game.score, "LIVES %d" % game.lives], "ENTER: NEXT STOP")
    elif s == "victory":
      ui_end("TOUR COMPLETE", GOLD2, ["GREASE & GOLD TAKE THE CROWN", "FINAL SCORE %07d" % game.score], "ENTER: TITLE")

func draw_title_bg() -> void:
  var si := 0 if game.state == "title" else 3
  var sc: float = fmod(game.t * 0.3, 600.0)
  var b = bgs[si]
  draw_texture(b[0], Vector2(-floorf(sc * 0.2), 0))
  draw_texture(b[1], Vector2(-floorf(sc * 0.5), 0))
  draw_texture(b[2], Vector2(-floorf(sc), 0))
  draw_rect(Rect2(0, 0, GW, GH), Color(0.055, 0.024, 0.094, 0.55))
  if game.state == "title":
    var ids := ["ricky", "vv", "johnny"]
    for i in 3:
      var e := {"kitId": ids[i], "anim": "idle", "frame": (game.t / 14 + i) % 4, "x": 112.0 + i * 80.0, "y": 198.0, "z": 0.0, "face": -1 if i == 2 else 1, "flash": 0}
      var save: float = game.cam_x
      game.cam_x = 0.0
      draw_fighter(e, 0, 0)
      game.cam_x = save

func draw_world() -> void:
  var cam: float = roundf(game.cam_x)
  var ox := 0.0
  var oy := 0.0
  if game.shake > 0.0:
    ox = roundf((randf() * 2.0 - 1.0) * game.shake)
    oy = roundf((randf() * 2.0 - 1.0) * game.shake * 0.6)
  draw_rect(Rect2(0, 0, GW, GH), Color.BLACK)
  var b = bgs[game.stage_idx]
  draw_texture(b[0], Vector2(-floorf(cam * 0.2) + ox, oy))
  draw_texture(b[1], Vector2(-floorf(cam * 0.5) + ox, oy))
  draw_texture(b[2], Vector2(-cam + ox, oy))
  var list: Array = []
  for o in game.props:
    list.append({"o": o, "y": o.y, "k": "prop"})
  for o in game.items:
    list.append({"o": o, "y": o.y, "k": "item"})
  for o in game.projs:
    list.append({"o": o, "y": o.y, "k": "proj"})
  for o in game.enemies:
    list.append({"o": o, "y": o.y, "k": "f"})
  for o in game.players:
    list.append({"o": o, "y": o.y, "k": "f"})
  list.sort_custom(func(a, c): return a.y < c.y)
  for q in list:
    var o: Dictionary = q.o
    var x: float = roundf(o.x - cam) + ox
    var y: float = roundf(o.y) + oy
    if q.k == "f":
      if o.state == "dead" and o.deadT > 40 and ((o.deadT >> 1) & 1) == 1:
        continue
      shadow(x, y, (o.hw * 2.0 + 6.0) * (1.0 - minf(0.5, o.z / 140.0)), 0.4 - minf(0.2, o.z / 300.0))
    elif q.k == "prop":
      shadow(x, y, 28, 0.35)
    elif q.k == "item":
      shadow(x, y, 22.0 - minf(8.0, o.z), 0.3)
    else:
      shadow(x, y, 8, 0.3)
  for q in list:
    var o: Dictionary = q.o
    var x: float = roundf(o.x - cam) + ox
    var y: float = roundf(o.y) + oy
    if q.k == "prop":
      var off := 0
      if o.shake > 0:
        off = 1 if (o.shake & 1) == 1 else -1
      draw_texture(props_tex[o.type], Vector2(x - 17 + off, y - 35))
    elif q.k == "item":
      draw_item(o, x, y)
    elif q.k == "proj":
      var zz := roundf(o.z)
      draw_rect(Rect2(x - 4, y - zz - 5, 8, 10), INK)
      draw_rect(Rect2(x - 3, y - zz - 4, 6, 8), Color("c8ccd6") if ((o.spin >> 2) & 1) == 1 else Color("8f98a8"))
      draw_rect(Rect2(x - 3, y - zz - 2, 6, 2), Color("d0402f"))
    else:
      if o.state == "dead" and o.deadT > 40 and ((o.deadT >> 1) & 1) == 1:
        continue
      if o.team == "p" and o.invuln > 0 and o.state != "dead" and ((o.invuln >> 2) & 1) == 1:
        continue
      draw_fighter(o, ox, oy)
      if o.warn and ((game.t >> 2) & 1) == 1:
        var hy := roundf(o.y - o.z - o.ht - 10.0) + oy
        draw_rect(Rect2(x - 3, hy - 1, 6, 12), INK)
        draw_rect(Rect2(x - 2, hy, 4, 7), Color("ff3a30"))
        draw_rect(Rect2(x - 2, hy + 9, 4, 2), Color("ff3a30"))
      if (o.state == "down" and o.downT < 36) or (o.state == "hit" and o.hitChain >= 2):
        var hy2: float = o.y - o.z - o.ht - 4.0
        for k in 3:
          var ang: float = game.t * 0.22 + k * 2.09
          draw_texture(fx.ko, Vector2(roundf(x + cos(ang) * 10.0) - 4, roundf(hy2 + sin(ang) * 3.0) - 4 + oy))
  for p in game.parts:
    var x: float = roundf(p.x - cam) + ox
    var y: float = roundf(p.y - p.z) + oy
    var age: int = p.age
    match p.type:
      "spark":
        draw_texture(fx.spark[mini(2, age >> 2)], Vector2(x - 12, y - 12))
      "boom":
        draw_texture(fx.boom[mini(2, age >> 2)], Vector2(x - 22, y - 22))
      "dust":
        draw_texture(fx.dust[mini(2, age >> 3)], Vector2(x - 12, y - 8), Color(1, 1, 1, minf(1.0, p.life / 12.0)))
      "debris":
        draw_rect(Rect2(x - 2, y - 2, 5, 5), INK)
        draw_rect(Rect2(x - 1, y - 1, 3, 3), Color(p.c))
      "plate":
        draw_texture(food_tex.empty, Vector2(x - 18, y - 26), Color(1, 1, 1, minf(1.0, p.life / 20.0)))
      "glow":
        var r := 1.0 + age * 0.08
        draw_texture_rect(fx.glow, Rect2(x - 15 * r, y - 15 * r, 30 * r, 30 * r), false, Color(1, 1, 1, minf(1.0, p.life / 10.0)))
      "sparkle":
        draw_texture(fx.sparkle[(age >> 2) % 3], Vector2(x - 4, y - 4))
      "text":
        txt(p.s, x, y, 9, Color("5fe06a"), 1)

func draw_item(o: Dictionary, x: float, y: float) -> void:
  var im: Texture2D = food_tex[o.type]
  var bob := 0
  if o.z <= 0.0:
    bob = roundi(sin(o.t * 0.12) * 2.0) + 4
  var zz := roundf(o.z) + bob
  var w := im.get_width()
  var h := im.get_height()
  if o.life < 180 and ((o.life >> 2) & 1) == 1:
    return
  var gl := 0.28 + 0.14 * sin(o.t * 0.15)
  draw_circle(Vector2(x, y - zz - h * 0.45), w * 0.5, Color(1, 0.84, 0.35, gl))
  draw_texture(im, Vector2(x - (w >> 1), y - zz - h + 3))
  for k in 3:
    var ph: int = (o.t + k * 23) % 70
    if ph < 14:
      var spt: Texture2D = fx.sparkle[0 if (ph < 5 or ph > 10) else 2]
      var a: float = o.t * 0.02 + k * 2.1
      draw_texture(spt, Vector2(roundf(x + cos(a * 3.0) * 14.0) - 4, roundf(y - zz - h * 0.5 + sin(a * 5.0) * 9.0) - 4))

# ---------------------------------------------------------------- UI (mirrors src/ui.js)
const REDD := Color("4a0f12")
const YEL := Color("ffd23a")
const BLU := Color("38b6ff")
const BLUD := Color("0d2a55")
const PANEL := Color("1d1030")

func frame(x: float, y: float, w: float, h: float, col: Color) -> void:
  draw_rect(Rect2(x - 3, y - 3, w + 6, h + 6), INK)
  draw_rect(Rect2(x - 2, y - 2, w + 4, h + 4), col)
  draw_rect(Rect2(x, y, w, h), PANEL)

func gauge(x: float, y: float, w: float, h: float, pct: float, fill: Color, back: Color, hi: Color) -> void:
  draw_rect(Rect2(x - 2, y - 2, w + 4, h + 4), INK)
  draw_rect(Rect2(x - 1, y - 1, w + 2, h + 2), CREAM)
  draw_rect(Rect2(x, y, w, h), back)
  var fw := roundf(w * clampf(pct, 0.0, 1.0))
  draw_rect(Rect2(x, y, fw, h), fill)
  draw_rect(Rect2(x, y, fw, maxf(1.0, floorf(h / 3.0))), hi)
  for i in range(1, 12):
    draw_rect(Rect2(x + w * i / 12.0 - 0.5, y, 1, h), Color(0, 0, 0, 0.35))

func stat_row(x: float, y: float, label: String, v: int) -> void:
  txt(label, x, y, 6, CREAM)
  for i in 5:
    draw_rect(Rect2(x + 40 + i * 11, y - 6, 9, 7), INK)
    draw_rect(Rect2(x + 41 + i * 11, y - 5, 7, 5), GOLD if i < v else Color("3a2a4a"))

func ui_title() -> void:
  draw_rect(Rect2(0, 30, GW, 88), Color(0.055, 0.024, 0.094, 0.55))
  txt("GREASE & GOLD", GW / 2.0 + 2, 68, 24, MAG, 1)
  txt("GREASE & GOLD", GW / 2.0, 66, 24, GOLD, 1)
  draw_rect(Rect2(86, 76, 212, 18), MAG)
  draw_rect(Rect2(86, 76, 212, 2), INK)
  draw_rect(Rect2(86, 92, 212, 2), INK)
  txt("WORLD TOUR", GW / 2.0, 90, 16, CREAM, 1)
  if ((game.t >> 5) & 1) == 1:
    txt("PRESS ENTER / START", GW / 2.0, 116, 8, CREAM, 1)
  txt("J ATTACK  K JUMP  L SPECIAL  U GRAB", GW / 2.0, 211, 6, DIM, 1)
  txt("GODOT PORT - PLAYTEST BUILD", GW / 2.0, 216, 6, Color("6a5a80"), 1)

func ui_select() -> void:
  txt("SELECT YOUR FIGHTER", GW / 2.0, 13, 8, GOLD, 1)
  var ids: Array = game.D.players
  for i in 3:
    var d: Dictionary = game.D.CH[ids[i]]
    var cx: float = GW / 2.0 + (i - 1) * 124.0
    var x := cx - 56.0
    var y := 19.0
    var sl: bool = i == game.sel
    frame(x, y, 112, 186, GOLD if sl else Color("5a4a6a"))
    var a: Dictionary = game.D.atlas[d.kit].idle
    var fr: int = (game.t / 14) % 4 if sl else 0
    draw_texture_rect_region(sheets[d.kit], Rect2(cx - 52, y + 3, 104, 104), Rect2(fr * CELL + AX - 52, int(a.row) * CELL + AY - 100, 104, 104), Color(1, 1, 1, 1.0 if sl else 0.55))
    txt(String(d.name).to_upper(), cx, y + 120, 8, GOLD2 if sl else CREAM, 1)
    txt(String(d.weapon).to_upper().substr(0, 18), cx, y + 129, 6, DIM, 1)
    txt(String(d.special).to_upper(), cx, y + 141, 6, MAG, 1)
    var k := 0
    for lab in [["POW", "power"], ["SPD", "speed"], ["RCH", "reach"], ["HP", "health"]]:
      stat_row(x + 8, y + 154 + k * 9, lab[0], int(d.stats[lab[1]]))
      k += 1
  var bl: PackedStringArray = String(game.D.CH[ids[game.sel]].blurb).to_upper().split("|")
  for m in bl.size():
    txt(bl[m], GW / 2.0, 211 + m * 5.5, 6, CREAM, 1)

func ui_hud() -> void:
  if game.players.is_empty():
    return
  var p: Dictionary = game.players[0]
  var d: Dictionary = p.def
  frame(7, 6, 40, 40, GOLD)
  draw_texture_rect(portraits[d.kit], Rect2(7, 6, 40, 40), false)
  draw_rect(Rect2(7, 36, 14, 10), INK)
  txt("1P", 8, 44, 6, GOLD2)
  txt(String(d.name).to_upper(), 56, 15, 8, GOLD2)
  txt("x%d" % maxi(0, game.lives), 150, 15, 8, CREAM, 2)
  var low: bool = p.hp / p.maxhp < 0.3 and ((game.t >> 3) & 1) == 1
  gauge(58, 20, 92, 8, p.hp / p.maxhp, Color("ff6a4a") if low else YEL, REDD, Color("fff0a0"))
  gauge(58, 32, 92, 5, p.hype / 100.0, Color("9be6ff") if p.state == "special" else BLU, BLUD, Color("d6f4ff"))
  txt("HYPE", 58, 45, 6, Color("9be6ff"))
  txt("SCORE", GW / 2.0 + 6, 11, 6, DIM, 1)
  txt("%07d" % game.score, GW / 2.0 + 6, 21, 8, CREAM, 1)
  if game.last_enemy_t > 0 and game.last_enemy != null and not game.last_enemy.boss:
    var e = game.last_enemy
    frame(331, 6, 40, 40, Color("b0407a"))
    draw_texture_rect(portraits[e.kitId], Rect2(331, 6, 40, 40), false)
    txt(String(e.def.name).to_upper().substr(0, 14), 326, 15, 6, CREAM, 2)
    gauge(236, 20, 90, 8, e.hp / e.maxhp, Color("ff5aa8"), Color("3a0f2a"), Color("ffc6e0"))
  for e in game.enemies:
    if e.boss and e.state != "dead" and e.state != "spawn":
      frame(40, 170, 30, 30, Color("b0407a"))
      draw_texture_rect(portraits[e.kitId], Rect2(40, 170, 30, 30), false)
      txt(String(e.def.name).to_upper(), 78, 181, 8, GOLD2)
      gauge(78, 186, 266, 10, e.hp / e.maxhp, Color("ff5aa8"), Color("3a0f2a"), Color("ffc6e0"))
      break
  if game.combo.n >= 2 and game.combo.t > 0:
    game.combo.pop = maxf(0.0, game.combo.pop - 0.5)
    txt("%d HITS" % game.combo.n, 8, 62, 8 + int(game.combo.pop * 0.8), GOLD2 if game.combo.n >= 8 else CREAM)
  if game.state == "play":
    if game.banner > 0:
      var al: float = clampf(minf(game.banner / 20.0, (170 - game.banner) / 12.0 + 0.2), 0.0, 1.0)
      draw_rect(Rect2(0, 78, GW, 54), Color(0.078, 0.035, 0.11, 0.85 * al))
      draw_rect(Rect2(0, 78, GW, 2), Color(MAG, al))
      draw_rect(Rect2(0, 130, GW, 2), Color(MAG, al))
      txt(String(game.stage.tour).replace("  ", " "), GW / 2.0, 94, 8, Color(MAG, al), 1)
      txt(String(game.stage.name).to_upper(), GW / 2.0, 120, 16, Color(GOLD, al), 1)
    if game.boss_banner > 0 and ((game.boss_banner >> 3) & 1) == 1:
      txt("WARNING", GW / 2.0, 80, 16, RED, 1)
    if game.wave_state == "walk" and game.wave_idx < game.stage.waves.size() and game.go_t > 10 and game.wave_idx > 0 and ((game.go_t >> 4) & 1) == 1:
      txt("GO", GW - 46, 90, 16, GOLD2, 1)
      draw_rect(Rect2(GW - 31, 86, 24, 14), INK)
      draw_rect(Rect2(GW - 30, 91, 10, 5), GOLD2)
      draw_colored_polygon(PackedVector2Array([Vector2(GW - 20, 87), Vector2(GW - 9, 93.5), Vector2(GW - 20, 100)]), GOLD2)
    if game.flash_t > 0:
      draw_rect(Rect2(0, 0, GW, GH), Color(1, 1, 1, game.flash_t / 10.0))

func ui_pause() -> void:
  draw_rect(Rect2(0, 0, GW, GH), Color(0.055, 0.024, 0.094, 0.82))
  txt("PAUSED", GW / 2.0, 40, 16, GOLD, 1)
  var items := ["RESUME", "RESTART STAGE", "HIDE CONTROLS" if game.show_help else "CONTROLS", "QUIT TO TITLE"]
  for i in 4:
    txt(("> " if i == game.menu else "  ") + items[i], GW / 2.0 - 70, 66 + i * 14, 8, GOLD2 if i == game.menu else CREAM)
  if game.show_help:
    var help := [["MOVE", "ARROWS / WASD"], ["ATTACK", "J / Z  TAP x3"], ["JUMP", "K / X / SPACE"], ["SPECIAL", "HOLD L / C"], ["GRAB+THROW", "U / V / I"], ["AIR ATTACK", "ATTACK IN AIR"], ["DIVE", "DOWN + AIR ATTACK"], ["PAUSE / MUTE", "ESC / M"]]
    for i in help.size():
      txt(help[i][0], 60, 136 + i * 9, 6, CREAM)
      txt(help[i][1], 170, 136 + i * 9, 6, DIM)

func ui_end(title: String, col: Color, lines: Array, hint: String) -> void:
  draw_rect(Rect2(0, 0, GW, GH), Color(0.055, 0.024, 0.094, 0.84))
  var sz := 16 if title.length() > 11 else 24
  txt(title, GW / 2.0 + 2, 68, sz, MAG, 1)
  txt(title, GW / 2.0, 66, sz, col, 1)
  for i in lines.size():
    txt(String(lines[i]).to_upper(), GW / 2.0, 98 + i * 16, 8, CREAM, 1)
  if ((game.t >> 5) & 1) == 1:
    txt(hint, GW / 2.0, 176, 8, GOLD2, 1)
