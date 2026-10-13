extends Node2D
## Draws the world (pixel-snapped, feet anchored at the sprite's (56,100)) and the UI. Mirrors src/ui.js.

var game
const CELL := 112
const AX := 56
const AY := 100
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
  font = ThemeDB.fallback_font
  var D = game.D
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
  draw_string_outline(font, Vector2(px, y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, max(2, int(size * 0.25)), INK)
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
      ui_end("GAME OVER", RED, ["Score  %06d" % game.score], "Enter: continue stage   Esc: title")
    elif s == "stageclear":
      ui_end("STAGE CLEAR", GOLD, [game.stage.name, "Score  %06d" % game.score, "Lives  %d" % game.lives], "Enter: next stop on the tour")
    elif s == "victory":
      ui_end("WORLD TOUR COMPLETE", GOLD2, ["Grease & Gold take the crown", "Final score  %06d" % game.score], "Enter: back to title")

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

# ---------------------------------------------------------------- UI
func ui_title() -> void:
  draw_rect(Rect2(GW / 2.0 - 128, 66, 256, 22), MAG)
  txt("GREASE", GW / 2.0 - 4, 60, 34, GOLD, 2)
  txt("&", GW / 2.0 + 15, 60, 34, MAG, 1)
  txt("GOLD", GW / 2.0 + 28, 60, 34, GOLD, 0)
  txt("W O R L D   T O U R", GW / 2.0, 83, 11, CREAM, 1)
  if ((game.t >> 5) & 1) == 1:
    txt("PRESS ENTER / START", GW / 2.0, 122, 9, CREAM, 1)
  txt("Move: arrows/WASD   Attack: J   Jump: K   Special (hold): L   Grab: U   Pause: Esc", GW / 2.0, 209, 5, DIM, 1)
  txt("Godot port - playtest build", GW / 2.0, 214, 4, DIM, 1)

func ui_select() -> void:
  txt("CHOOSE YOUR FIGHTER", GW / 2.0, 20, 13, GOLD, 1)
  var ids: Array = game.D.players
  for i in 3:
    var d: Dictionary = game.D.CH[ids[i]]
    var cx: float = GW / 2.0 + (i - 1) * 124.0
    var x := cx - 56.0
    var y := 28.0
    var sl: bool = i == game.sel
    box(x, y, 112, 176, Color("2a1238") if sl else Color("1a0d26"), GOLD if sl else Color("4a3a5a"), 2 if sl else 1)
    var a: Dictionary = game.D.atlas[d.kit].idle
    var fr: int = (game.t / 14) % 4 if sl else 0
    draw_texture_rect_region(sheets[d.kit], Rect2(cx - 40, y + 4, 80, 82), Rect2(fr * CELL + AX - 40, int(a.row) * CELL + AY - 78, 80, 82), Color(1, 1, 1, 1.0 if sl else 0.6))
    txt(d.name, cx, y + 98, 11, GOLD2 if sl else CREAM, 1)
    txt(d.weapon, cx, y + 107, 6, DIM, 1)
    txt("SPECIAL", x + 8, y + 120, 6, MAG)
    txt(d.special, x + 46, y + 120, 6, CREAM)
    var k := 0
    for lab in ["power", "speed", "reach", "health"]:
      txt(lab.to_upper(), x + 8, y + 133 + k * 9, 6, CREAM)
      for j in 5:
        draw_rect(Rect2(x + 60 + j * 9, y + 127.4 + k * 9, 7.4, 6), GOLD if j < int(d.stats[lab]) else Color("3a2a4a"))
      k += 1
    var bl: PackedStringArray = String(d.blurb).split("|")
    for m in bl.size():
      txt(bl[m], cx, y + 169 + m * 5.6, 5, DIM, 1)
  txt("LEFT / RIGHT choose     ENTER fight     ESC back", GW / 2.0, 212, 6, CREAM, 1)

func ui_hud() -> void:
  if game.players.is_empty():
    return
  var p: Dictionary = game.players[0]
  var d: Dictionary = p.def
  box(6, 6, 36, 36, INK, GOLD, 2)
  draw_texture_rect(portraits[d.kit], Rect2(8, 8, 32, 32), false)
  txt(d.name, 48, 15, 9, GOLD2)
  txt("x%d" % maxi(0, game.lives), 150, 15, 9, CREAM, 2)
  txt("HP", 48, 26, 6, CREAM)
  var low: bool = p.hp / p.maxhp < 0.3 and ((game.t >> 3) & 1) == 1
  bar(72, 19.5, 78, 8, p.hp / p.maxhp, Color("ff7a5a") if low else Color("e0322e"), Color("3a1420"))
  txt("HYPE", 48, 36, 6, MAG)
  bar(72, 31, 78, 6, p.hype / 100.0, GOLD2 if p.state == "special" else GOLD, Color("33210a"))
  txt("%06d" % game.score, GW / 2.0, 16, 13, CREAM, 1)
  txt("SCORE", GW / 2.0, 24, 5, DIM, 1)
  if game.last_enemy_t > 0 and game.last_enemy != null and not game.last_enemy.boss:
    var e = game.last_enemy
    txt(e.def.name, GW - 8, 15, 7, CREAM, 2)
    bar(GW - 98, 19, 90, 6, e.hp / e.maxhp, MAG, Color("2a1030"))
  for e in game.enemies:
    if e.boss and e.state != "dead" and e.state != "spawn":
      txt(String(e.def.name).to_upper(), GW / 2.0, GH - 19, 9, GOLD2, 1)
      bar(GW / 2.0 - 110, GH - 15, 220, 9, e.hp / e.maxhp, MAG, Color("2a1030"))
      break
  if game.combo.n >= 2 and game.combo.t > 0:
    game.combo.pop = maxf(0.0, game.combo.pop - 0.5)
    txt("%d HITS" % game.combo.n, 8, 58, 10 + int(game.combo.pop * 0.6), GOLD2 if game.combo.n >= 8 else CREAM)
  if game.state == "play":
    if game.banner > 0:
      var al: float = clampf(minf(game.banner / 20.0, (170 - game.banner) / 12.0 + 0.2), 0.0, 1.0)
      draw_rect(Rect2(0, 78, GW, 52), Color(0.078, 0.035, 0.11, 0.78 * al))
      draw_rect(Rect2(0, 78, GW, 2), Color(MAG, al))
      draw_rect(Rect2(0, 128, GW, 2), Color(MAG, al))
      txt(game.stage.tour, GW / 2.0, 94, 8, Color(MAG, al), 1)
      txt(String(game.stage.name).to_upper(), GW / 2.0, 118, 22, Color(GOLD, al), 1)
    if game.boss_banner > 0 and ((game.boss_banner >> 3) & 1) == 1:
      txt("WARNING   BOSS", GW / 2.0, 84, 18, RED, 1)
    if game.wave_state == "walk" and game.wave_idx < game.stage.waves.size() and game.go_t > 10 and game.wave_idx > 0 and ((game.go_t >> 4) & 1) == 1:
      txt("GO", GW - 44, 86, 18, GOLD2, 1)
      draw_rect(Rect2(GW - 30, 91, 10, 6), GOLD2)
      draw_colored_polygon(PackedVector2Array([Vector2(GW - 20, 86), Vector2(GW - 10, 94), Vector2(GW - 20, 102)]), GOLD2)
    if game.flash_t > 0:
      draw_rect(Rect2(0, 0, GW, GH), Color(1, 1, 1, game.flash_t / 10.0))

func ui_pause() -> void:
  draw_rect(Rect2(0, 0, GW, GH), Color(0.055, 0.024, 0.094, 0.78))
  txt("PAUSED", GW / 2.0, 44, 20, GOLD, 1)
  var items := ["Resume", "Restart stage", "Hide controls" if game.show_help else "Controls", "Quit to title"]
  for i in 4:
    txt(("> " if i == game.menu else "  ") + items[i], GW / 2.0 - 48, 70 + i * 15, 10, GOLD2 if i == game.menu else CREAM)
  if game.show_help:
    var help := [["Move", "Arrows / WASD"], ["Attack (tap x3 = combo)", "J or Z"], ["Jump", "K, X or Space"], ["Special (hold)", "L or C"], ["Grab / Throw", "U, V or I"], ["Pause", "Esc or P"], ["Mute", "M"], ["Air attacks", "Attack in air / Down+Attack = dive"], ["Gamepad", "A jump, X attack, B special, Y grab, Start"]]
    for i in help.size():
      txt(help[i][0], GW / 2.0 - 150, 144 + i * 7.2, 5, CREAM)
      txt(help[i][1], GW / 2.0 + 10, 144 + i * 7.2, 5, DIM)

func ui_end(title: String, col: Color, lines: Array, hint: String) -> void:
  draw_rect(Rect2(0, 0, GW, GH), Color(0.055, 0.024, 0.094, 0.8))
  txt(title, GW / 2.0, 70, 20 if title.length() > 12 else 26, col, 1)
  for i in lines.size():
    txt(lines[i], GW / 2.0, 98 + i * 16, 11, CREAM, 1)
  if ((game.t >> 5) & 1) == 1:
    txt(hint, GW / 2.0, 176, 8, GOLD2, 1)
