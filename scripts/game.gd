extends Node2D
## GREASE & GOLD: WORLD TOUR — Godot port of the 1.0 HTML build.
## By Player529 & XiON. 480x270 pixel-perfect canvas, 60Hz physics.

const W := 480.0
const H := 270.0
const BUILD_TAG := "build 2026-10-12f-godot"

# --- textures (2x exports of the cleaned sprite set) ---
const TEX := {
	"ricky": [
		preload("res://sprites/ricky_idle.png"),
		preload("res://sprites/ricky_walk.png"),
		preload("res://sprites/ricky_attack.png"),
		preload("res://sprites/ricky_hurt.png"),
	],
	"vv": [
		preload("res://sprites/vv_idle.png"),
		preload("res://sprites/vv_walk.png"),
		preload("res://sprites/vv_attack.png"),
		preload("res://sprites/vv_hurt.png"),
	],
	"johnny": [
		preload("res://sprites/johnny_idle.png"),
		preload("res://sprites/johnny_walk.png"),
		preload("res://sprites/johnny_attack.png"),
		preload("res://sprites/johnny_hurt.png"),
	],
	"guard": [
		preload("res://sprites/guard_idle.png"),
		preload("res://sprites/guard_attack.png"),
	],
	"exec": [
		preload("res://sprites/exec_idle.png"),
		preload("res://sprites/exec_attack.png"),
	],
	"ledger": [
		preload("res://sprites/ledger_idle.png"),
		preload("res://sprites/ledger_attack.png"),
	],
	"heavy": [
		preload("res://sprites/heavy_idle.png"),
		preload("res://sprites/heavy_attack.png"),
	],
}
const BG_TEX := preload("res://sprites/bg_stage1.png")

const CHARS := [
	{"key": "ricky", "name": "RICKY B", "hp": 100.0, "spd": 2.2, "atk": 12.0, "spec": "FLAG FURY"},
	{"key": "johnny", "name": "JOHNNY $ALAMI", "hp": 120.0, "spd": 1.8, "atk": 16.0, "spec": "SALAMI SLAM"},
	{"key": "vv", "name": "V.V.", "hp": 90.0, "spd": 2.6, "atk": 10.0, "spec": "MIC DROP"},
]

# --- game state (mirrors the JS G object) ---
var state: String = "title"
var gt: int = 0
var sel: int = 0
var player: Fighter = null
var foes: Array = []
var fx: Array = []
var camX: float = 0.0
var wave: int = 0
var shake: float = 0.0
var freeze: int = 0
var score: int = 0
var lives: int = 3
var msg: String = ""
var msgT: int = 0
var spawnT: int = 0


func _ready() -> void:
	randomize()


func _physics_process(_delta: float) -> void:
	_update()
	queue_redraw()


# ---------------------------------------------------------------- combat ---
func _hurt_foe(f: Foe, dmg: float, kx: float, ax: float, launch: bool) -> void:
	if f.inv > 0 or f.hp <= 0.0:
		return
	if not launch and f.type == "exec" and sign(ax - f.x) == f.face and randf() < 0.35:
		fx.append({"x": f.x, "y": f.y - 60.0, "t": 0, "kind": "block"})
		f.vx = kx * 0.3 / f.wt
		return
	f.hp -= dmg
	f.inv = 10
	f.vx = kx / sqrt(f.wt)
	f.vy = (randf() - 0.5) * 1.2
	if launch:
		f.st = "launched"
		f.t = 0
		f.vx = kx * 1.8 / sqrt(f.wt)
		shake = 8.0
		freeze = 8
		fx.append({"x": f.x, "y": f.y - 50.0, "t": 0, "kind": "launch"})
	elif f.type != "heavy" or f.hp <= 0.0:
		f.st = "hurt"
		f.t = 0
		shake = 4.0
		freeze = 4
	fx.append({"x": f.x, "y": f.y - 50.0, "t": 0, "kind": "hit"})
	player.hype = minf(100.0, player.hype + 5.0)
	if f.hp <= 0.0:
		f.hp = 0.0
		f.st = "down"
		f.t = 0
		f.vx = kx * 1.5 / sqrt(f.wt)
		score += 100
		player.hype = minf(100.0, player.hype + 12.0)
		if randf() < 0.3:
			fx.append({"x": f.x, "y": f.y, "t": 0, "kind": "kebab"})


func _hurt_player(dmg: float, kx: float) -> void:
	var p := player
	if p.inv > 0 or p.hp <= 0.0 or p.z > 25.0:
		return
	p.hp -= dmg
	p.inv = 25
	p.vx = kx
	p.vy = randf() - 0.5
	p.st = "hurt"
	p.t = 0
	shake = 5.0
	freeze = 5
	if p.hp <= 0.0:
		p.hp = 0.0


func _player_attack() -> void:
	var p := player
	if p.st == "attack":
		if p.atkT > 8:
			p.atkBuf = true
		return
	if p.st != "idle" and p.st != "walk":
		return
	p.st = "attack"
	p.specAtk = false
	p.atkT = 0
	p.atkBuf = false
	p.inv = maxi(p.inv, 12)


func _do_attack_hit() -> void:
	var p := player
	var reach := 60.0
	var hx: float = p.x + p.face * reach
	var finisher: bool = (p.atkN == 2)
	for f in foes:
		if f.hp <= 0.0:
			continue
		var dx: float = absf(f.x - hx)
		var dy: float = absf(f.y - p.y)
		if dx < 40.0 and dy < 30.0 and sign(f.x - p.x) == p.face:
			_hurt_foe(f, p.atk + p.atkN * 4.0, p.face * (7.0 if finisher else 4.0), p.x, finisher)
	fx.append({"x": hx, "y": p.y - 50.0, "t": 0, "kind": "slash", "face": p.face})
	p.atkN = (p.atkN + 1) % 3


func _player_special() -> void:
	var p := player
	if p.hype < 30.0 or (p.st != "idle" and p.st != "walk"):
		return
	p.hype -= 30.0
	p.st = "attack"
	p.specAtk = true
	p.atkT = 0
	p.atkBuf = false
	fx.append({"x": p.x, "y": p.y - 50.0, "t": 0, "kind": "spec", "txt": p.spec})
	shake = 8.0


func _do_special_hit() -> void:
	var p := player
	for f in foes:
		if f.hp <= 0.0:
			continue
		if absf(f.x - p.x) < 85.0 and absf(f.y - p.y) < 32.0:
			_hurt_foe(f, 30.0, (1.0 if f.x > p.x else -1.0) * 8.0, p.x, true)


# ---------------------------------------------------------------- physics ---
func _phys_foe(f: Foe, wantX: float, wantY: float) -> void:
	var a: float = 0.22 / sqrt(f.wt)
	f.vx += (wantX - f.vx) * a
	f.vy += (wantY - f.vy) * a
	f.x += f.vx
	f.y += f.vy
	f.x = clampf(f.x, 30.0, 950.0)
	f.y = clampf(f.y, 185.0, 245.0)


func _phys_friction(o, rate: float) -> void:
	o.vx *= rate
	o.vy *= rate
	o.x += o.vx
	o.y += o.vy
	o.x = clampf(o.x, 30.0, 950.0)
	o.y = clampf(o.y, 185.0, 245.0)


# ------------------------------------------------------------------ flow ---
func _spawn_wave() -> void:
	wave += 1
	if wave == 1:
		foes.append(Foe.make("guard", 620.0, 205.0))
		foes.append(Foe.make("guard", 700.0, 228.0))
		foes.append(Foe.make("guard", 780.0, 212.0))
		msg = "WAVE 1"
		msgT = 90
	elif wave == 2:
		foes.append(Foe.make("exec", 640.0, 210.0))
		foes.append(Foe.make("exec", 740.0, 225.0))
		foes.append(Foe.make("heavy", 840.0, 215.0))
		msg = "WAVE 2"
		msgT = 90
	elif wave == 3:
		foes.append(Foe.make("ledger", 760.0, 215.0))
		foes.append(Foe.make("guard", 660.0, 228.0))
		msg = "LEDGER"
		msgT = 120


func _start_fight() -> void:
	var c: Dictionary = CHARS[sel]
	player = Fighter.make(c["key"], c["name"], c["hp"], c["spd"], c["atk"], c["spec"])
	foes = []
	fx = []
	wave = 0
	score = 0
	spawnT = 0
	camX = 0.0
	_spawn_wave()
	state = "fight"


func _attackers_out() -> int:
	var n := 0
	for f in foes:
		if f.hp > 0.0 and (f.st == "attack" or f.st == "tele" or f.st == "charge"):
			n += 1
	return n


func _update() -> void:
	gt += 1
	if freeze > 0:
		freeze -= 1
		return
	if shake > 0.0:
		shake *= 0.9
	# screen shake offsets the whole canvas, like the JS build
	if shake > 0.5:
		position = Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * shake
	else:
		position = Vector2.ZERO

	if state == "title":
		if Input.is_action_just_pressed("confirm"):
			state = "select"
	elif state == "select":
		if Input.is_action_just_pressed("mv_left"):
			sel = (sel + 2) % 3
		if Input.is_action_just_pressed("mv_right"):
			sel = (sel + 1) % 3
		if Input.is_action_just_pressed("sel1"):
			sel = 0
			_start_fight()
		elif Input.is_action_just_pressed("sel2"):
			sel = 1
			_start_fight()
		elif Input.is_action_just_pressed("sel3"):
			sel = 2
			_start_fight()
		elif Input.is_action_just_pressed("confirm") or Input.is_action_just_pressed("atk"):
			_start_fight()
	elif state == "fight":
		_update_fight()
	elif state == "pause":
		if Input.is_action_just_pressed("pause_game"):
			state = "fight"
	elif state == "clear" or state == "over":
		if Input.is_action_just_pressed("confirm"):
			state = "title"
			sel = 0
			lives = 3
			camX = 0.0

	for i in range(fx.size() - 1, -1, -1):
		fx[i]["t"] += 1
		if fx[i]["t"] > 40:
			fx.remove_at(i)
	if msgT > 0:
		msgT -= 1
	if spawnT > 0:
		spawnT -= 1
		if spawnT == 0:
			_spawn_wave()


func _update_fight() -> void:
	var p := player
	if p == null or p.hp <= 0.0:
		lives -= 1
		if lives <= 0:
			state = "over"
			return
		p.hp = p.maxhp
		p.x = 100.0
		p.y = 215.0
		p.vx = 0.0
		p.vy = 0.0
		p.st = "idle"
		p.inv = 60
		return

	var mx: float = (1.0 if Input.is_action_pressed("mv_right") else 0.0) - (1.0 if Input.is_action_pressed("mv_left") else 0.0)
	var my: float = (1.0 if Input.is_action_pressed("mv_down") else 0.0) - (1.0 if Input.is_action_pressed("mv_up") else 0.0)
	if p.st == "idle" or p.st == "walk":
		if mx != 0.0 or my != 0.0:
			p.st = "walk"
			p.vx += (mx * p.spd - p.vx) * 0.35
			p.vy += (my * p.spd * 0.7 - p.vy) * 0.35
			if mx != 0.0:
				p.face = 1 if mx > 0.0 else -1
		else:
			p.st = "idle"
			p.vx *= 0.7
			p.vy *= 0.7
		p.x = clampf(p.x + p.vx, 30.0, 950.0)
		p.y = clampf(p.y + p.vy, 185.0, 245.0)
	elif p.st == "hurt":
		p.t += 1
		_phys_friction(p, 0.88)
		if p.t > 18:
			p.st = "idle"
			p.t = 0

	if p.st == "attack":
		p.atkT += 1
		if not p.specAtk and p.atkT == 8:
			_do_attack_hit()
		if p.specAtk and p.atkT == 12:
			_do_special_hit()
		var dur: int = 30 if p.specAtk else 18
		if p.atkT >= dur:
			if p.atkBuf and not p.specAtk:
				p.atkT = 0
				p.atkBuf = false
				p.inv = maxi(p.inv, 12)
			else:
				p.st = "idle"
				p.atkT = 0
				p.atkN = 0

	if Input.is_action_just_pressed("atk"):
		_player_attack()
	if Input.is_action_just_pressed("spec"):
		_player_special()
	if Input.is_action_just_pressed("jump") and p.z == 0.0 and (p.st == "idle" or p.st == "walk"):
		p.vz = 6.0
		p.z = 1.0
	if Input.is_action_just_pressed("pause_game"):
		state = "pause"

	if p.z > 0.0 or p.vz != 0.0:
		p.z += p.vz
		p.vz -= 0.4
		if p.z <= 0.0:
			p.z = 0.0
			p.vz = 0.0
	if p.inv > 0:
		p.inv -= 1

	for i in range(fx.size() - 1, -1, -1):
		var e: Dictionary = fx[i]
		if e["kind"] == "kebab" and p.hp < p.maxhp and absf(e["x"] - p.x) < 25.0 and absf(e["y"] - p.y) < 20.0:
			p.hp = minf(p.maxhp, p.hp + 30.0)
			fx.remove_at(i)

	for f in foes:
		_update_foe(f)

	var alive := false
	var settling := false
	for f in foes:
		if f.hp > 0.0:
			alive = true
		elif f.t < 60:
			settling = true
	if not alive and not settling and spawnT == 0:
		if wave < 3:
			spawnT = 70
			msg = "WAVE " + str(wave + 1)
			msgT = 70
		else:
			state = "clear"

	camX = clampf(player.x - 200.0, 0.0, 520.0)


func _update_foe(f: Foe) -> void:
	var p := player
	if f.hp <= 0.0:
		f.t += 1
		if f.st == "down":
			_phys_friction(f, 0.92)
		return
	f.t += 1
	if f.inv > 0:
		f.inv -= 1
	f.face = 1 if (p.x - f.x) > 0.0 else -1

	if f.st == "hurt":
		_phys_friction(f, 0.88)
		if f.t > 15:
			f.st = "idle"
			f.t = 0
			f.mode = "hold"
		return
	if f.st == "launched":
		_phys_friction(f, 0.94)
		if absf(f.vx) < 0.8 and absf(f.vy) < 0.8:
			f.st = "ko"
			f.t = 0
		return
	if f.st == "ko":
		if f.t > 45:
			f.st = "idle"
			f.t = 0
			f.mode = "hold"
			f.aiT = 30
		return

	var dx: float = p.x - f.x
	var dy: float = p.y - f.y
	var dist: float = absf(dx)

	if f.st == "tele":
		if f.t > 30:
			f.st = "charge"
			f.t = 0
		return
	if f.st == "charge":
		f.vx = f.face * 4.5
		f.vy = 0.0
		f.x += f.vx
		f.x = clampf(f.x, 30.0, 950.0)
		if absf(f.x - p.x) < 32.0 and absf(f.y - p.y) < 22.0:
			_hurt_player(f.atk, f.face * 7.0)
		if f.t > 26:
			f.st = "idle"
			f.t = 0
			f.atkCd = 150
			f.vx = 0.0
			f.mode = "hold"
			f.aiT = 40
		return

	if f.st == "attack":
		_phys_friction(f, 0.8)
	else:
		if f.mode == "":
			f.mode = "hold"
			f.aiT = 40 + int(randf() * 70.0)
			f.offY = randf() * 36.0 - 18.0
			f.strafeDir = 1 if randf() < 0.5 else -1
		f.aiT -= 1
		var laneDy: float = (p.y + f.offY) - f.y
		var inRange: bool = dist <= f.reach and absf(dy) < 20.0

		if f.mode == "hold":
			f.st = "idle"
			_phys_foe(f, 0.0, 0.0)
			if f.aiT <= 0:
				f.mode = "strafe" if inRange else "advance"
				f.aiT = 45 + int(randf() * 55.0)
		elif f.mode == "strafe":
			f.st = "walk"
			if f.y <= 190.0 or f.y >= 240.0:
				f.strafeDir *= -1
			elif randf() < 0.015:
				f.strafeDir *= -1
			var tx := 0.0
			if dist > f.reach + 34.0:
				tx = sign(dx) * f.spd * 0.5
			elif dist < f.reach - 12.0:
				tx = -sign(dx) * f.spd * 0.4
			_phys_foe(f, tx, f.strafeDir * f.spd * 0.45)
			if f.aiT <= 0:
				f.mode = "advance"
				f.aiT = 55 + int(randf() * 60.0)
		else:  # advance
			f.st = "walk"
			var ty: float = sign(laneDy) * f.spd * 0.5 if absf(laneDy) > 8.0 else 0.0
			_phys_foe(f, sign(dx) * f.spd, ty)
			if inRange or f.aiT <= 0:
				f.mode = "hold"
				f.aiT = 25 + int(randf() * 45.0)

		if inRange and f.atkCd <= 0 and _attackers_out() < 2:
			if f.type == "heavy":
				f.st = "tele"
				f.t = 0
				fx.append({"x": f.x, "y": f.y - f.h - 14.0, "t": 0, "kind": "warn"})
			else:
				f.st = "attack"
				f.t = 0
				f.atkCd = 120
				f.atkCount += 1
				if f.type == "ledger" and f.atkCount % 3 == 0:
					fx.append({"x": f.x, "y": f.y - 40.0, "t": 0, "kind": "slam"})
					shake = 8.0
					if absf(p.x - f.x) < 75.0 and absf(p.y - f.y) < 30.0:
						_hurt_player(20.0, (1.0 if p.x > f.x else -1.0) * 7.0)
				else:
					if p.inv <= 0 and p.z < 20.0:
						_hurt_player(f.atk, (1.0 if p.x > f.x else -1.0) * 5.0)
	if f.st == "attack" and f.t > 25:
		f.st = "idle"
		f.t = 0
		f.mode = "hold"
		f.aiT = 30 + int(randf() * 40.0)
	if f.atkCd > 0:
		f.atkCd -= 1

	for o in foes:
		if o == f or o.hp <= 0.0:
			continue
		var ox: float = f.x - o.x
		var oy: float = f.y - o.y
		var d: float = sqrt(ox * ox + oy * oy)
		if d < 48.0 and d > 0.5:
			f.x += (ox / d) * 1.4
			f.y = clampf(f.y + (oy / d) * 1.0, 185.0, 245.0)


# ---------------------------------------------------------------- drawing ---
func _draw_sprite(key: String, frame: int, pos: Vector2, face: int, h: float, rock: float, alpha: float) -> void:
	var tex: Texture2D = TEX[key][frame]
	var s: float = h / tex.get_height()
	draw_set_transform(pos, rock, Vector2(face * s, s))
	var mod := Color(1, 1, 1, alpha)
	draw_texture(tex, Vector2(-tex.get_width() / 2.0, -tex.get_height()), mod)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_shadow(x: float, y: float) -> void:
	draw_set_transform(Vector2(x, y + 2.0), 0.0, Vector2(1.0, 0.28))
	draw_circle(Vector2.ZERO, 18.0, Color(0, 0, 0, 0.4))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_background() -> void:
	# bg file is 2x (2000x540); draw at 0.5 so it lands at 1000x270 like the JS build
	draw_set_transform(Vector2(-camX, 0), 0.0, Vector2(0.5, 0.5))
	draw_texture(BG_TEX, Vector2.ZERO)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# gold GREASE & GOLD sign (same coords as the JS build)
	var sx: float = 150.0 - camX
	if sx > -220.0 and sx < W + 20.0:
		draw_rect(Rect2(sx, 42, 200, 30), Color(0.79, 0.64, 0.15))
		draw_rect(Rect2(sx + 4, 46, 192, 22), Color(0.10, 0.06, 0.0))
		_draw_text("GREASE & GOLD", Vector2(sx + 100, 61), 11, Color(0.79, 0.64, 0.15), true)
	# purple SOHBET billboard (same coords as the JS build)
	var bx: float = 640.0 - camX
	if bx > -180.0 and bx < W + 20.0:
		draw_rect(Rect2(bx, 46, 170, 64), Color(0.36, 0.16, 0.53))
		draw_rect(Rect2(bx, 46, 170, 6), Color(0.48, 0.25, 0.69))
		draw_circle(Vector2(bx + 55, 72), 14, Color.WHITE)
		draw_circle(Vector2(bx + 75, 72), 14, Color(1, 0, 1))
		draw_circle(Vector2(bx + 55, 72), 9, Color.WHITE)
		draw_rect(Rect2(bx + 48, 82, 6, 8), Color.WHITE)
		draw_rect(Rect2(bx + 76, 82, 6, 8), Color(1, 0, 1))
		_draw_text("SOHBET", Vector2(bx + 118, 80), 13, Color.WHITE, true)


func _draw_text(txt: String, pos: Vector2, size: int, color: Color, centered: bool) -> void:
	var font: Font = ThemeDB.fallback_font
	var align := HORIZONTAL_ALIGNMENT_CENTER if centered else HORIZONTAL_ALIGNMENT_LEFT
	# draw_string positions by baseline; nudge up so pos ≈ visual center
	draw_string(font, pos + Vector2(0, size * 0.35), txt, align, -1.0, size, color)


func _draw() -> void:

	if state == "title":
		_draw_background()
		draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.55))
		_draw_text("GREASE & GOLD", Vector2(W / 2, 100), 30, Color(0.79, 0.64, 0.15), true)
		_draw_text("WORLD TOUR", Vector2(W / 2, 132), 30, Color(0.79, 0.64, 0.15), true)
		_draw_text("By Player529 & XiON", Vector2(W / 2, 160), 12, Color.WHITE, true)
		if int(gt / 30) % 2 == 0:
			_draw_text("Press ENTER or TAP", Vector2(W / 2, 205), 12, Color(0.79, 0.64, 0.15), true)
		_draw_text("Arrows/WASD move - Z attack - X special - Space jump", Vector2(W / 2, 240), 10, Color(0.53, 0.53, 0.53), true)
		_draw_text(BUILD_TAG, Vector2(W / 2, 258), 9, Color(0.27, 0.27, 0.27), true)
	elif state == "select":
		_draw_background()
		draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.55))
		_draw_text("SELECT FIGHTER", Vector2(W / 2, 40), 16, Color.WHITE, true)
		for i in CHARS.size():
			var c: Dictionary = CHARS[i]
			var x: float = 90.0 + i * 150.0
			if i == sel:
				draw_rect(Rect2(x - 60, 55, 120, 150), Color(0.79, 0.64, 0.15), false, 3.0)
			_draw_sprite(c["key"], 0, Vector2(x, 185), 1, 84.0, 0.0, 1.0)
			_draw_text(c["name"], Vector2(x, 215), 10, Color(0.79, 0.64, 0.15) if i == sel else Color.WHITE, true)
			_draw_text("HP %d ATK %d" % [c["hp"], c["atk"]], Vector2(x, 228), 10, Color(0.53, 0.53, 0.53), true)
		_draw_text("Arrows / 1-2-3 + Enter", Vector2(W / 2, 255), 10, Color(0.53, 0.53, 0.53), true)
	elif state == "fight" or state == "pause":
		_draw_background()
		_draw_fight()
		if state == "pause":
			draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.7))
			_draw_text("PAUSED", Vector2(W / 2, 130), 20, Color.WHITE, true)
			_draw_text("ESC to resume", Vector2(W / 2, 155), 11, Color.WHITE, true)
	elif state == "clear":
		_draw_background()
		draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.6))
		_draw_text("STAGE CLEAR!", Vector2(W / 2, 120), 24, Color(0, 1, 0), true)
		_draw_text("Score: %d" % score, Vector2(W / 2, 150), 14, Color.WHITE, true)
		if int(gt / 30) % 2 == 0:
			_draw_text("Press ENTER", Vector2(W / 2, 185), 14, Color.WHITE, true)
	elif state == "over":
		draw_rect(Rect2(0, 0, W, H), Color.BLACK)
		_draw_text("GAME OVER", Vector2(W / 2, 120), 24, Color(1, 0, 0), true)
		_draw_text("Score: %d" % score, Vector2(W / 2, 150), 14, Color.WHITE, true)
		if int(gt / 30) % 2 == 0:
			_draw_text("Press ENTER", Vector2(W / 2, 185), 14, Color.WHITE, true)


func _draw_fight() -> void:
	var p := player
	if p == null:
		return
	# actors sorted by y
	var actors: Array = [p]
	for f in foes:
		if f.hp > 0.0 or f.t < 60:
			actors.append(f)
	actors.sort_custom(func(a, b): return a.y < b.y)

	for a in actors:
		var isP: bool = (a == p)
		var key: String = a.key if isP else a.type
		var frame := 0
		if a.st == "walk":
			frame = (0 if int(gt / 12) % 2 == 0 else 1) if isP else 0
		elif a.st == "attack" or a.st == "tele" or a.st == "charge":
			frame = 2 if isP else 1
		elif a.st == "hurt" or a.st == "down" or a.st == "launched" or a.st == "ko":
			frame = 3 if isP else 0

		_draw_shadow(a.x - camX, a.y)
		var h: float = 84.0 if isP else a.h
		var bobY := 0.0
		var lungeX := 0.0
		var rock := 0.0
		if not isP and a.st == "walk":
			var ph: bool = int(gt / 7) % 2 == 0
			bobY = 0.0 if ph else -5.0
			rock = 0.05 if ph else -0.05
		if a.st == "launched":
			rock = 0.35 if fmod(gt * 0.3, PI * 2.0) > PI else -0.35
		if not isP and a.st == "attack" and a.t < 12:
			lungeX = a.face * 5.0
		if isP and a.st == "attack" and not a.specAtk and p.atkT < 10:
			lungeX = a.face * 4.0
		var alpha := 1.0
		if a.inv > 0 and int(gt / 3) % 2 == 0:
			alpha = 0.5
		if a.st == "tele" and int(gt / 4) % 2 == 0:
			alpha = 0.7
		_draw_sprite(key, frame, Vector2(a.x - camX + lungeX, a.y - a.z + bobY), a.face, h, rock, alpha)

		if not isP and a.hp > 0.0:
			var bw := 44.0
			var bx: float = a.x - camX - bw / 2.0
			var by: float = a.y - h - 12.0
			draw_rect(Rect2(bx, by, bw, 5), Color(0.27, 0, 0))
			var bar_col := Color(1.0, 0.53, 0.0) if (a.type == "ledger" or a.type == "heavy") else Color(1, 0, 0)
			draw_rect(Rect2(bx, by, bw * (a.hp / a.maxhp), 5), bar_col)

	# effects
	for e in fx:
		var ex: float = e["x"] - camX
		var ey: float = e["y"]
		match e["kind"]:
			"slash":
				draw_arc(Vector2(ex, ey), 16.0 + e["t"] * 2.0, 0.0, 6.0, 16, Color.WHITE, 3.0)
			"hit":
				draw_rect(Rect2(ex - 4, ey - 4, 8, 8), Color(1, 1, 0))
			"launch":
				_draw_text("SMASH!", Vector2(ex, ey - e["t"] * 2.0), 14, Color(1, 1, 0), true)
			"kebab":
				draw_rect(Rect2(ex - 8, ey - 4, 16, 8), Color(0.65, 0.16, 0.16))
				draw_rect(Rect2(ex - 8, ey - 4, 16, 3), Color(0.82, 0.41, 0.12))
			"spec":
				_draw_text(e["txt"], Vector2(ex, ey - e["t"]), 14, Color(0.79, 0.64, 0.15), true)
			"block":
				draw_rect(Rect2(ex - 12, ey - 8, 24, 16), Color(0.27, 0.67, 1.0), false, 2.0)
				_draw_text("BLOCK", Vector2(ex, ey - 12.0), 9, Color(0.27, 0.67, 1.0), true)
			"warn":
				_draw_text("!", Vector2(ex, ey - fmod(e["t"], 8.0)), 16, Color(1, 0, 0), true)
			"slam":
				draw_arc(Vector2(ex, ey), 20.0 + e["t"] * 3.0, 0.0, 6.0, 16, Color(1, 0.53, 0), 4.0)

	# HUD
	draw_rect(Rect2(0, 0, W, 28), Color.BLACK)
	_draw_sprite(p.key, 0, Vector2(20, 26), 1, 24.0, 0.0, 1.0)
	_draw_text(p.char_name, Vector2(36, 12), 10, Color.WHITE, false)
	draw_rect(Rect2(36, 15, 120, 8), Color(0.27, 0, 0))
	draw_rect(Rect2(36, 15, 120.0 * (p.hp / p.maxhp), 8), Color(0, 1, 0) if p.hp > 30.0 else Color(1, 0, 0))
	draw_rect(Rect2(36, 24, 80, 4), Color(0.13, 0.13, 0))
	draw_rect(Rect2(36, 24, 80.0 * (p.hype / 100.0), 4), Color(0.79, 0.64, 0.15))
	_draw_text("WAVE %d/3" % maxi(1, wave), Vector2(W / 2, 18), 10, Color.WHITE, true)
	_draw_text("SCORE %d" % score, Vector2(W - 10, 12), 10, Color.WHITE, false)
	_draw_text("LIVES x%d" % lives, Vector2(W - 10, 24), 10, Color.WHITE, false)

	if msgT > 0:
		_draw_text(msg, Vector2(W / 2, 100), 20, Color(0.79, 0.64, 0.15), true)

	var boss: Foe = null
	for f in foes:
		if f.type == "ledger" and f.hp > 0.0:
			boss = f
	if boss:
		draw_rect(Rect2(W / 2 - 100, H - 20, 200, 10), Color(0.27, 0, 0))
		draw_rect(Rect2(W / 2 - 100, H - 20, 200.0 * (boss.hp / boss.maxhp), 10), Color(1, 0, 0))
		_draw_text("LEDGER", Vector2(W / 2, H - 24), 10, Color.WHITE, true)
