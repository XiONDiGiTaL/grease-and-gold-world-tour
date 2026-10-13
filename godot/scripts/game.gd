extends Node2D
## Grease & Gold: World Tour - Godot 4 port. Logic mirrors src/game.js and reads the same
## tables from data/game_data.json (exported by tools/export_godot_data.js). Fixed 60 Hz.

const GW := 384
const GH := 216
const FT := 134.0
const FB := 204.0
const BUF := 9
const BTN := ["left", "right", "up", "down", "attack", "jump", "special", "grab", "pause", "start", "back"]

var D: Dictionary
var TIMING: Dictionary
var use_real_input := true
var held := {}
var buf := {}
var edge := {}
var mute := false

var state := "loading"
var sel := 0
var menu := 0
var show_help := false
var t := 0
var god_mode := false
var char_id := "ricky"
var stage_idx := 0
var stage: Dictionary = {}
var lives := 3
var score := 0
var best := 0
var carry = null

var players: Array = []
var enemies: Array = []
var props: Array = []
var items: Array = []
var projs: Array = []
var parts: Array = []
var spawn_q: Array = []
var hitstop := 0
var shake := 0.0
var cam_x := 0.0
var cam_max := 0.0
var wave_idx := 0
var wave_state := "walk"
var banner := 0
var boss_banner := 0
var go_t := 0
var clear_t := 0
var combo := {"n": 0, "t": 0, "pop": 0.0}
var last_enemy = null
var last_enemy_t := 0
var stage_t := 0
var flash_t := 0
var next_id := 1
var sfx := {}
var sfx_players: Array = []
var renderer: Node2D

const GRAV := 0.24
const JUMPV := 4.7
const WALKY := 1.0
const DRAIN := 0.28
const DROPS := ["adana", "adana", "adana", "shish", "shish", "lahmacun", "lahmacun", "kunefe", "doner"]

func _ready() -> void:
  var f := FileAccess.open("res://data/game_data.json", FileAccess.READ)
  D = JSON.parse_string(f.get_as_text())
  TIMING = D.TIMING
  for b in BTN:
    held[b] = false
    buf[b] = 0
    edge[b] = false
  _setup_input_map()
  _make_sfx()
  var rs = load("res://scripts/render.gd")
  renderer = rs.new()
  renderer.game = self
  add_child(renderer)
  state = "title"

func _physics_process(_dt: float) -> void:
  if use_real_input:
    _poll_real()
  update()

# ---------------------------------------------------------------- input
func _setup_input_map() -> void:
  var keymap := {
    "left": [KEY_LEFT, KEY_A], "right": [KEY_RIGHT, KEY_D], "up": [KEY_UP, KEY_W], "down": [KEY_DOWN, KEY_S],
    "attack": [KEY_J, KEY_Z], "jump": [KEY_K, KEY_X, KEY_SPACE], "special": [KEY_L, KEY_C], "grab": [KEY_U, KEY_V, KEY_I],
    "pause": [KEY_ESCAPE, KEY_P], "start": [KEY_ENTER, KEY_KP_ENTER], "back": [KEY_BACKSPACE]}
  for a in keymap:
    if not InputMap.has_action(a):
      InputMap.add_action(a)
    for k in keymap[a]:
      var ev := InputEventKey.new()
      ev.physical_keycode = k
      InputMap.action_add_event(a, ev)
  var pad := {"jump": JOY_BUTTON_A, "special": JOY_BUTTON_B, "attack": JOY_BUTTON_X, "grab": JOY_BUTTON_Y, "pause": JOY_BUTTON_START, "start": JOY_BUTTON_A,
    "left": JOY_BUTTON_DPAD_LEFT, "right": JOY_BUTTON_DPAD_RIGHT, "up": JOY_BUTTON_DPAD_UP, "down": JOY_BUTTON_DPAD_DOWN}
  for a in pad:
    var ev := InputEventJoypadButton.new()
    ev.button_index = pad[a]
    InputMap.action_add_event(a, ev)
  var axes := {"left": [JOY_AXIS_LEFT_X, -1.0], "right": [JOY_AXIS_LEFT_X, 1.0], "up": [JOY_AXIS_LEFT_Y, -1.0], "down": [JOY_AXIS_LEFT_Y, 1.0]}
  for a in axes:
    var ev := InputEventJoypadMotion.new()
    ev.axis = axes[a][0]
    ev.axis_value = axes[a][1]
    InputMap.action_add_event(a, ev)
    InputMap.action_set_deadzone(a, 0.4)

func _poll_real() -> void:
  for b in BTN:
    set_btn(b, Input.is_action_pressed(b))
  if Input.is_key_pressed(KEY_M) and not _m_down:
    mute = not mute
  _m_down = Input.is_key_pressed(KEY_M)
var _m_down := false

func set_btn(b: String, v: bool) -> void:
  if v and not held[b]:
    buf[b] = BUF
    edge[b] = true
  held[b] = v
func pressed(b: String) -> bool:
  return buf[b] > 0
func consume(b: String) -> bool:
  if buf[b] > 0:
    buf[b] = 0
    return true
  return false
func just(b: String) -> bool:
  return edge[b]
func axis_x() -> int:
  return (1 if held.right else 0) - (1 if held.left else 0)
func axis_y() -> int:
  return (1 if held.down else 0) - (1 if held.up else 0)
func clear_input() -> void:
  for b in BTN:
    held[b] = false
    buf[b] = 0
    edge[b] = false

# ---------------------------------------------------------------- audio (synthesised)
func _tone(f0: float, f1: float, dur: float, kind: String, vol: float) -> PackedFloat32Array:
  var rate := 22050
  var n := int(dur * rate)
  var out := PackedFloat32Array()
  out.resize(n)
  var ph := 0.0
  for i in n:
    var u := float(i) / n
    var fr := f0 * pow(max(f1, 30.0) / f0, u)
    ph += fr / rate
    var w := 0.0
    if kind == "square":
      w = 1.0 if fmod(ph, 1.0) < 0.5 else -1.0
    else:
      w = fmod(ph, 1.0) * 2.0 - 1.0
    out[i] = w * vol * pow(0.001 / max(vol, 0.001), u)
  return out
func _noise(dur: float, vol: float, lp: float) -> PackedFloat32Array:
  var rate := 22050
  var n := int(dur * rate)
  var out := PackedFloat32Array()
  out.resize(n)
  var a := 1.0 - exp(-TAU * lp / rate)
  var y := 0.0
  for i in n:
    y += a * ((randf() * 2.0 - 1.0) * (1.0 - float(i) / n) - y)
    out[i] = y * vol * 2.0
  return out
func _mix(a: PackedFloat32Array, b: PackedFloat32Array, seq := false) -> PackedFloat32Array:
  var out := PackedFloat32Array()
  if seq:
    out.append_array(a)
    out.append_array(b)
    return out
  out.resize(max(a.size(), b.size()))
  for i in a.size():
    out[i] += a[i]
  for i in b.size():
    out[i] += b[i]
  return out
func _wav(s: PackedFloat32Array) -> AudioStreamWAV:
  var w := AudioStreamWAV.new()
  w.format = AudioStreamWAV.FORMAT_16_BITS
  w.mix_rate = 22050
  var d := PackedByteArray()
  d.resize(s.size() * 2)
  for i in s.size():
    d.encode_s16(i * 2, int(clampf(s[i], -1.0, 1.0) * 32000.0))
  w.data = d
  return w
func _make_sfx() -> void:
  sfx["swing"] = _wav(_noise(.08, .12, 3000))
  sfx["hit"] = _wav(_mix(_noise(.07, .25, 1800), _tone(180, 60, .09, "square", .12)))
  sfx["heavy"] = _wav(_mix(_noise(.16, .35, 900), _tone(120, 40, .2, "square", .2)))
  sfx["jump"] = _wav(_tone(260, 520, .12, "square", .07))
  sfx["land"] = _wav(_noise(.05, .12, 500))
  sfx["pick"] = _wav(_mix(_tone(660, 990, .08, "square", .1), _tone(990, 1320, .1, "square", .1), true))
  sfx["smash"] = _wav(_mix(_noise(.2, .3, 2200), _tone(200, 80, .15, "saw", .1)))
  sfx["ko"] = _wav(_mix(_tone(420, 70, .4, "saw", .15), _noise(.25, .2, 1200)))
  sfx["special"] = _wav(_tone(200, 400, .1, "saw", .08))
  sfx["throw"] = _wav(_tone(500, 160, .18, "square", .1))
  sfx["go"] = _wav(_mix(_tone(520, 520, .1, "square", .09), _tone(780, 780, .15, "square", .09), true))
  sfx["ui"] = _wav(_tone(440, 660, .06, "square", .07))
  sfx["warn"] = _wav(_tone(300, 300, .06, "square", .05))
  for i in 8:
    var p := AudioStreamPlayer.new()
    add_child(p)
    sfx_players.append(p)
func play(n: String) -> void:
  if mute or not sfx.has(n):
    return
  for p in sfx_players:
    if not p.playing:
      p.stream = sfx[n]
      p.play()
      return

# ---------------------------------------------------------------- helpers
func _id() -> int:
  next_id += 1
  return next_id
func sgn(v: float) -> int:
  return -1 if v < 0.0 else 1
func rnd(a: float, b: float) -> float:
  return randf_range(a, b)
func set_anim(e: Dictionary, a: String) -> void:
  if e.anim != a:
    e.anim = a
    e.frame = 0
    e.ft = 0.0
    e.done = false
func restart_anim(e: Dictionary, a: String) -> void:
  e.anim = a
  e.frame = 0
  e.ft = 0.0
  e.done = false
func advance(e: Dictionary, loop: bool, rate := 1.0) -> void:
  var T: Array = TIMING[e.anim]
  e.ft += rate
  while e.ft >= T[e.frame]:
    e.ft -= T[e.frame]
    e.frame += 1
    if e.frame >= T.size():
      if loop:
        e.frame = 0
      else:
        e.frame = T.size() - 1
        e.done = true
        e.ft = 0.0
        break
func _inl(a, v) -> bool:
  for x in a:
    if int(x) == int(v):
      return true
  return false

# ---------------------------------------------------------------- run / stage flow
func reset_world() -> void:
  players = []
  enemies = []
  props = []
  items = []
  projs = []
  parts = []
  spawn_q = []
  hitstop = 0
  shake = 0.0
  cam_x = 0.0
  cam_max = 0.0
  wave_idx = 0
  wave_state = "walk"
  banner = 0
  boss_banner = 0
  go_t = 0
  clear_t = 0
  combo = {"n": 0, "t": 0, "pop": 0.0}
  last_enemy = null
  last_enemy_t = 0
  flash_t = 0

func start_run(cid: String) -> void:
  char_id = cid
  lives = 3
  score = 0
  carry = null
  start_stage(0)

func start_stage(i: int) -> void:
  var st: Dictionary = D.STAGES[i]
  stage_idx = i
  stage = st
  reset_world()
  var p := make_player(char_id)
  if carry != null:
    p.hp = min(p.maxhp, max(carry.hp, p.maxhp * 0.5))
    p.hype = max(25.0, carry.hype)
  p.lives = lives
  players = [p]
  for q in st.props:
    var hpv := 3 if (q[0] == "barrel" or q[0] == "bin") else 4
    props.append({"id": _id(), "kind": "prop", "type": q[0], "x": float(q[1]), "y": float(q[2]), "z": 0.0, "hp": float(hpv), "hw": 12.0, "hd": 9.0, "ht": 26.0, "shake": 0, "remove": false})
  banner = 170
  state = "play"
  stage_t = 0
  cam_max = float(st.waves[0].x)
  cam_x = 0.0

func make_player(id: String) -> Dictionary:
  var d: Dictionary = D.CH[id]
  var sc: float = D.kits[d.kit].scale
  return {"id": _id(), "kind": "fighter", "team": "p", "cid": id, "def": d, "kitId": d.kit, "x": 70.0, "y": 172.0, "z": 0.0, "vx": 0.0, "vy": 0.0, "vz": 0.0, "face": 1,
    "hp": float(d.hp), "maxhp": float(d.hp), "hype": 30.0, "state": "idle", "anim": "idle", "frame": 0, "ft": 0.0, "phase": 0.0, "hw": 11.0 * sc, "hd": 7.0, "ht": 56.0 * sc,
    "invuln": 90, "flash": 0, "hitChain": 0, "chainT": 0, "comboTimer": 0, "nextStep": 0, "step": 0, "hitSet": [], "rate": float(d.rate), "spT": 0, "pulses": 0,
    "held": null, "grabT": 0, "gcount": 0, "downT": 0, "deadT": 0, "done": false, "stun": 0, "swung": false, "lunged": false, "struck": false, "thrown": false, "heldBy": null,
    "armor": false, "warn": false, "t": 0, "lives": 3, "remove": false}

func make_enemy(type: String, x: float, y: float) -> Dictionary:
  var d: Dictionary = D.ED[type]
  var sc: float = D.kits[d.kit].scale
  var hw: float = d.get("hw", 11.0)
  return {"id": _id(), "kind": "fighter", "team": "e", "type": type, "def": d, "kitId": d.kit, "x": x, "y": y, "z": 0.0, "vx": 0.0, "vy": 0.0, "vz": 0.0, "face": -1,
    "hp": float(d.hp), "maxhp": float(d.hp), "state": "spawn", "anim": "walk", "frame": 0, "ft": 0.0, "phase": 0.0, "hw": hw * sc, "hd": 7.0, "ht": 58.0 * sc,
    "invuln": 0, "flash": 0, "hitChain": 0, "chainT": 0, "cool": 40.0 + randf() * 40.0, "token": false, "ring": rnd(72, 118), "laneOff": rnd(-26, 26),
    "poise": float(d.get("poise", 0)), "hitSet": [], "downT": 0, "deadT": 0, "armor": false, "rate": 1.0, "retreat": 0, "atk": null, "boss": d.get("boss", false),
    "summoned": false, "grabT": 0, "done": false, "stun": 0, "next": "", "windScale": 1.0, "warn": false, "heldBy": null, "thrown": false, "tiredT": 0, "ct": 0, "remove": false, "owner": null, "thrownHit": []}

# ---------------------------------------------------------------- main tick
func update() -> void:
  t += 1
  var frozen: bool = state == "play" and hitstop > 0 and not just("pause")
  if state == "play":
    update_play()
  else:
    update_menus()
  if not frozen:
    for b in BTN:
      if buf[b] > 0:
        buf[b] -= 1
  for b in BTN:
    edge[b] = false

func update_play() -> void:
  if just("pause"):
    state = "pause"
    menu = 0
    play("ui")
    return
  if hitstop > 0:
    hitstop -= 1
    shake *= 0.9
    return
  stage_t += 1
  for p in players:
    update_player(p)
  for e in enemies:
    update_enemy(e)
  update_tokens()
  separate()
  for pr in projs:
    update_proj(pr)
  projs = projs.filter(func(q): return q.life > 0)
  for pp in props:
    if pp.shake > 0:
      pp.shake -= 1
  update_items()
  update_parts()
  update_waves()
  update_camera()
  enemies = enemies.filter(func(e): return not e.remove)
  props = props.filter(func(q): return not q.remove)
  if banner > 0:
    banner -= 1
  if shake > 0.0:
    shake *= 0.88
  if shake < 0.15:
    shake = 0.0
  if combo.t > 0:
    combo.t -= 1
    if combo.t <= 0:
      combo.n = 0
  if last_enemy_t > 0:
    last_enemy_t -= 1
  if flash_t > 0:
    flash_t -= 1

# ---------------------------------------------------------------- players
func update_player(p: Dictionary) -> void:
  p.t += 1
  if p.invuln > 0:
    p.invuln -= 1
  if p.flash > 0:
    p.flash -= 1
  if p.comboTimer > 0:
    p.comboTimer -= 1
  if p.chainT > 0:
    p.chainT -= 1
    if p.chainT == 0:
      p.hitChain = 0
  var ax := axis_x()
  var ay := axis_y()
  match p.state:
    "idle", "walk":
      player_ground(p, ax, ay)
    "attack":
      player_attack(p)
    "jump", "jatk", "jdown":
      player_air(p, ax, ay)
    "land":
      advance(p, false, 1.0)
      p.vx *= 0.8
      p.vy *= 0.8
      if p.done:
        p.state = "idle"
        set_anim(p, "idle")
    "special":
      player_special(p)
    "grab", "gstrike", "throw":
      player_grab(p, ax, ay)
    "hit":
      advance(p, false, 1.0)
      p.x += p.vx
      p.vx *= 0.85
      p.stun -= 1
      if p.stun <= 0:
        p.state = "idle"
        set_anim(p, "idle")
    "knock":
      knock_step(p)
    "down":
      down_step(p, 46)
    "getup":
      advance(p, false, 1.0)
      if p.done:
        p.state = "idle"
        set_anim(p, "idle")
    "dead":
      dead_step(p)
    "win":
      advance(p, true, 1.0)
  if p.state != "dead" and p.state != "down":
    clamp_player(p)
  pickup_check(p)

func clamp_player(p: Dictionary) -> void:
  p.x = clampf(p.x, cam_x + 14.0, cam_x + GW - 14.0)
  p.y = clampf(p.y, FT, FB)

func player_ground(p: Dictionary, ax: int, ay: int) -> void:
  if ax != 0:
    p.face = ax
  if consume("jump"):
    p.state = "jump"
    p.vz = JUMPV
    p.vx *= 0.95
    p.vy *= 0.8
    set_anim(p, "jump")
    play("jump")
    return
  if consume("special") and p.hype > 0.0:
    start_special(p)
    return
  if consume("attack"):
    start_attack(p, p.nextStep if p.comboTimer > 0 else 0)
    return
  if consume("grab"):
    try_grab(p)
    if p.state == "grab":
      return
  var tx: float = ax * float(p.def.spd)
  var ty: float = ay * WALKY * (float(p.def.spd) / 1.5)
  if ax != 0 and ay != 0:
    tx *= 0.86
    ty *= 0.86
  p.vx += (tx - p.vx) * 0.5
  p.vy += (ty - p.vy) * 0.5
  if absf(p.vx) < 0.05:
    p.vx = 0.0
  if absf(p.vy) < 0.05:
    p.vy = 0.0
  p.x += p.vx
  p.y += p.vy
  var sp := Vector2(p.vx, p.vy).length()
  if sp > 0.2:
    p.state = "walk"
    set_anim(p, "walk")
    walk_phase(p)
  else:
    if p.state == "walk":
      p.state = "idle"
      set_anim(p, "idle")
    advance(p, true, 1.0)

func walk_phase(e: Dictionary) -> void:
  var sp := Vector2(e.vx, e.vy).length()
  var back := -1 if (absf(e.vx) > absf(e.vy) and e.vx * e.face < 0.0) else 1
  e.phase += back * sp / 40.0
  e.phase = fposmod(e.phase, 1.0)
  e.frame = floori(e.phase * 8.0) % 8

func start_attack(p: Dictionary, step: int) -> void:
  p.state = "attack"
  p.step = step
  p.hitSet = []
  p.swung = false
  p.lunged = false
  p.vx *= 0.2
  p.vy *= 0.2
  restart_anim(p, ["a1", "a2", "a3"][step])

func player_attack(p: Dictionary) -> void:
  var mv: Dictionary = p.def.moves[p.step]
  advance(p, false, p.rate)
  p.x += p.vx
  p.vx *= 0.8
  if p.frame == 1 and not p.lunged:
    p.lunged = true
    p.vx = p.face * 1.0
  if _inl(mv.hit, p.frame):
    if not p.swung:
      p.swung = true
      play("swing")
    strike(p, mv.box, mv, p.hitSet)
  if p.frame > int(mv.hit[mv.hit.size() - 1]) and p.step < 2 and consume("attack"):
    start_attack(p, p.step + 1)
    return
  if p.done:
    p.comboTimer = 18 if p.step < 2 else 0
    p.nextStep = p.step + 1 if p.step < 2 else 0
    p.state = "idle"
    set_anim(p, "idle")

func player_air(p: Dictionary, ax: int, ay: int) -> void:
  p.vz -= GRAV
  p.z += p.vz
  p.vx += (ax * float(p.def.spd) * 0.85 - p.vx) * 0.07
  p.vy += (ay * 0.7 - p.vy) * 0.07
  p.x += p.vx
  p.y += p.vy
  if p.state == "jump":
    p.frame = 0 if p.vz > 1.2 else (1 if p.vz > -1.2 else 2)
    if consume("attack"):
      if ay > 0:
        p.state = "jdown"
        restart_anim(p, "jdown")
        p.vz = min(p.vz, -1.5)
      else:
        p.state = "jatk"
        restart_anim(p, "jatk")
      p.hitSet = []
      play("swing")
  else:
    advance(p, false, 1.0)
    var mv: Dictionary = D.MV.JATK if p.state == "jatk" else D.MV.JDOWN
    strike(p, mv.box, mv, p.hitSet)
  if p.z <= 0.0 and p.vz < 0.0:
    p.z = 0.0
    p.vz = 0.0
    p.state = "land"
    restart_anim(p, "land")
    dust(p.x, p.y, 2)
    play("land")

func start_special(p: Dictionary) -> void:
  p.state = "special"
  p.spT = 0
  p.pulses = 0
  p.vx = 0.0
  p.vy = 0.0
  restart_anim(p, "special")

func player_special(p: Dictionary) -> void:
  var sp: Dictionary = p.def.spec
  if not held.special or p.hype <= 0.0:
    p.state = "land"
    restart_anim(p, "land")
    return
  p.hype = max(0.0, p.hype - DRAIN)
  advance(p, true, 1.0)
  p.spT += 1
  var ph: int = p.spT % int(sp.pulse)
  if ph == 1:
    p.hitSet = []
    p.pulses += 1
    play("special")
  if ph >= 1 and ph <= 4:
    var mv: Dictionary = sp.duplicate()
    mv["special"] = true
    mv["knock"] = (p.pulses % int(sp.knockEvery)) == 0
    mv["launch"] = 2.4
    strike(p, sp.box, mv, p.hitSet)

func try_grab(p: Dictionary) -> void:
  var best_e = null
  var bd := 1e9
  for e in enemies:
    if not grabbable(e):
      continue
    var dx: float = (e.x - p.x) * p.face
    if dx < -6.0 or dx > 28.0 or absf(e.y - p.y) > 10.0:
      continue
    if dx < bd:
      bd = dx
      best_e = e
  if best_e == null:
    return
  p.state = "grab"
  p.held = best_e
  p.grabT = 0
  p.gcount = 0
  restart_anim(p, "grab")
  p.vx = 0.0
  p.vy = 0.0
  best_e.state = "held"
  best_e.heldBy = p
  best_e.grabT = 0
  best_e.atk = null
  best_e.armor = false
  best_e.warn = false
  play("hit")

func grabbable(e: Dictionary) -> bool:
  if e.team != "e" or e.remove:
    return false
  if e.z == 0.0 and e.state in ["idle", "hit", "tired", "retreat"]:
    return true
  return e.state == "attack" and e.atk != null and e.atk.phase == "windup" and not e.def.get("boss", false)

func release(p: Dictionary) -> void:
  var e = p.held
  if e != null:
    e.heldBy = null
    if e.state == "held":
      e.state = "idle"
      e.cool = 40.0
      set_anim(e, "idle")
  p.held = null

func player_grab(p: Dictionary, ax: int, _ay: int) -> void:
  var e = p.held
  if e == null or e.state != "held":
    p.held = null
    p.state = "idle"
    set_anim(p, "idle")
    return
  e.x += (p.x + p.face * 17.0 - e.x) * 0.5
  e.y += (p.y - e.y) * 0.5
  e.face = -p.face
  e.grabT += 1
  p.grabT += 1
  if e.grabT > int(e.def.get("grabEscape", 140)):
    release(p)
    p.state = "idle"
    set_anim(p, "idle")
    p.invuln = 10
    return
  if p.state == "grab":
    advance(p, true, 1.0)
    if consume("attack"):
      p.state = "gstrike"
      restart_anim(p, "gstrike")
      p.struck = false
    elif consume("grab") or consume("jump"):
      if ax != 0:
        p.face = ax
      p.state = "throw"
      restart_anim(p, "throw")
      p.thrown = false
  elif p.state == "gstrike":
    advance(p, false, 1.1)
    if p.frame == 1 and not p.struck:
      p.struck = true
      var mv: Dictionary = D.MV.GSTRIKE[p.gcount % 3]
      p.gcount += 1
      play("swing")
      hurt(e, p, mv)
      if p.gcount % 3 == 0 or e.state != "held":
        p.held = null
        e.heldBy = null
    if p.done:
      p.state = "grab" if p.held != null else "idle"
      restart_anim(p, "grab" if p.held != null else "idle")
  elif p.state == "throw":
    advance(p, false, 1.0)
    if p.frame == 1 and not p.thrown:
      p.thrown = true
      e.x = p.x + p.face * 14.0
      e.face = -p.face
      e.heldBy = null
      p.held = null
      hurt(e, p, D.MV.THROWMV.duplicate())
      e.vx = p.face * 3.6
      e.vz = 3.4
      e.thrown = true
      e.thrownHit = [e.id]
      e.owner = p
      play("throw")
    if p.done:
      p.state = "idle"
      set_anim(p, "idle")

# ---------------------------------------------------------------- shared physics
func knock_step(e: Dictionary) -> void:
  e.vz -= GRAV
  e.z += e.vz
  e.x += e.vx
  e.y = clampf(e.y + e.vy, FT, FB)
  e.vx *= 0.985
  if e.team == "p":
    e.x = clampf(e.x, cam_x + 6.0, cam_x + GW - 6.0)
  e.anim = "knock"
  e.frame = 0 if (e.vz > 0.0 or e.z > 16.0) else 1
  if e.thrown:
    var mv: Dictionary = D.MV.THROWHIT.duplicate()
    mv["owner"] = e.owner
    strike(e, {"x0": -14.0, "x1": 14.0, "d": 10.0, "z0": 0.0, "z1": 44.0}, mv, e.thrownHit)
  if e.z <= 0.0 and e.vz < 0.0:
    e.z = 0.0
    e.vz = 0.0
    e.vx *= 0.4
    e.thrown = false
    e.state = "down"
    e.downT = 0
    restart_anim(e, "down")
    dust(e.x, e.y, 3)
    shake = max(shake, 2.5)
    play("land")
    if e.hp <= 0.0:
      e.state = "dead"
      e.deadT = 0
      restart_anim(e, "dead")

func down_step(e: Dictionary, wait: int) -> void:
  e.downT += 1
  e.x += e.vx
  e.vx *= 0.85
  if e.team == "p":
    e.x = clampf(e.x, cam_x + 6.0, cam_x + GW - 6.0)
  e.anim = "down"
  e.frame = 0 if e.downT < 10 else 1
  if e.downT > wait:
    e.state = "getup"
    restart_anim(e, "getup")
    e.invuln = 36

func dead_step(e: Dictionary) -> void:
  e.deadT += 1
  e.x += e.vx
  e.vx *= 0.85
  if e.team == "p":
    e.anim = "dead"
    e.frame = 0
    if e.deadT > 80:
      player_died(e)
  else:
    e.frame = 0
    if e.deadT > 70:
      e.remove = true

func player_died(p: Dictionary) -> void:
  lives -= 1
  if lives <= 0:
    state = "gameover"
    menu = 0
    play("ko")
    return
  p.lives = lives
  p.hp = p.maxhp
  p.x = cam_x + 60.0
  p.y = 170.0
  p.z = 0.0
  p.state = "idle"
  p.invuln = 150
  p.hitChain = 0
  set_anim(p, "idle")
  p.vx = 0.0
  p.vy = 0.0

# ---------------------------------------------------------------- hit detection (x range in facing dir, lane depth, height)
func strike(att: Dictionary, box: Dictionary, mv: Dictionary, hit_set: Array) -> bool:
  var f: int = att.face
  var x0: float = att.x + f * float(box.x0)
  var x1: float = att.x + f * float(box.x1)
  if x0 > x1:
    var tmp := x0
    x0 = x1
    x1 = tmp
  var z0: float = att.z + float(box.z0)
  var z1: float = att.z + float(box.z1)
  var who: Dictionary = mv.owner if mv.get("owner") != null else att
  var targets: Array
  if att.team == "e" and mv.get("owner") == null:
    targets = players
  elif who.team == "p":
    targets = enemies + props
  else:
    targets = players
  var hit := false
  for tg in targets:
    if hit_set.has(tg.id) or tg.id == att.id:
      continue
    if tg.kind == "fighter" and not can_be_hit(tg):
      continue
    if x1 < tg.x - tg.hw or x0 > tg.x + tg.hw:
      continue
    if absf(tg.y - att.y) > float(box.d) + tg.hd:
      continue
    if z1 < tg.z or z0 > tg.z + tg.ht:
      continue
    hit_set.append(tg.id)
    hurt(tg, att, mv)
    hit = true
  return hit

func can_be_hit(tg: Dictionary) -> bool:
  if tg.invuln > 0 or (god_mode and tg.team == "p"):
    return false
  return not (tg.state in ["down", "dead", "getup", "knock"]) and not tg.remove

func hurt(tg: Dictionary, a: Dictionary, mv: Dictionary) -> void:
  var who: Dictionary = mv.owner if mv.get("owner") != null else a
  var f: int = a.face
  if mv.get("omni", false):
    f = 1 if tg.x >= a.x else -1
  var sx: float = tg.x - f * tg.hw * 0.4
  var sy: float = tg.y
  var zmid := 30.0
  if mv.has("box"):
    zmid = (float(mv.box.z0) + float(mv.box.z1)) / 2.0
  var sz: float = clampf(a.z + zmid, tg.z + 10.0, tg.z + tg.ht - 6.0)
  if tg.kind == "prop":
    tg.hp -= 0.5 if mv.get("special", false) else 1.0
    tg.shake = 8
    spark(sx, sy, sz, 0)
    play("hit")
    hitstop = max(hitstop, 2)
    if tg.hp <= 0.0:
      break_prop(tg)
    return
  var dmg: float = mv.dmg
  tg.hp -= dmg
  tg.flash = 4
  var knock: bool = tg.hp <= 0.0 or mv.get("knock", false) or tg.hitChain >= 2
  if tg.team == "e" and tg.def.has("poise"):
    tg.poise -= dmg
    if tg.poise <= 0.0:
      knock = true
      tg.poise = float(tg.def.poise)
    elif tg.hp > 0.0:
      knock = false
  var no_flinch: bool = (tg.armor or tg.state == "special") and not knock
  if tg.kind == "fighter" and tg.team == "p" and tg.held != null:
    release(tg)
  if knock:
    if tg.heldBy != null and tg.heldBy.id != a.id:
      var h = tg.heldBy
      h.held = null
      h.state = "idle"
      set_anim(h, "idle")
    tg.heldBy = null
    tg.state = "knock"
    tg.vz = float(mv.get("launch", 3.0))
    tg.vx = f * float(mv.get("kb", 2.4))
    tg.atk = null
    tg.armor = false
    tg.warn = false
    tg.hitChain = 0
    restart_anim(tg, "knock")
    tg.thrown = false
  elif not no_flinch:
    if tg.state == "held":
      tg.flash = 6
    else:
      tg.state = "hit"
      tg.stun = int(mv.get("stun", 18))
      tg.vx = f * float(mv.get("kb", 1.5))
      tg.atk = null
      tg.armor = false
      tg.warn = false
      tg.hitChain += 1
      tg.chainT = 45
      restart_anim(tg, "hit")
  var heavy: bool = knock or dmg >= 9.0
  hitstop = max(hitstop, int(mv.get("hs", 3)))
  shake = max(shake, 3.2 if heavy else 1.4)
  spark(sx, sy, sz, 1 if heavy else 0)
  play("ko" if tg.hp <= 0.0 else ("heavy" if heavy else "hit"))
  if who.team == "p":
    if tg.team == "e":
      score += roundi(dmg * 10.0)
      last_enemy = tg
      last_enemy_t = 150
      if tg.hp <= 0.0:
        score += int(tg.def.score)
    if not mv.get("special", false) and float(mv.get("hype", 4)) != 0.0:
      who.hype = min(100.0, who.hype + float(mv.get("hype", 4))) # HYPE only from ordinary attacks
    combo.n += 1
    combo.t = 100
    combo.pop = 8.0

func break_prop(p: Dictionary) -> void:
  p.remove = true
  play("smash")
  shake = max(shake, 2.0)
  var cols := {"barrel": "3b6aa8", "bin": "7d8590"}
  for i in 12:
    parts.append({"type": "debris", "x": p.x + rnd(-8, 8), "y": p.y, "z": rnd(6, 20), "vx": rnd(-1.8, 1.8), "vy": rnd(-0.3, 0.3), "vz": rnd(1.5, 3.8), "life": 40, "age": 0, "c": cols.get(p.type, "a8702f")})
  dust(p.x, p.y, 3)
  if randf() < 0.7:
    items.append({"type": DROPS[randi() % DROPS.size()], "x": p.x, "y": p.y, "z": 18.0, "vz": 2.0, "life": 900, "t": 0, "taken": false})

# ---------------------------------------------------------------- enemies
func nearest_player(e: Dictionary):
  var b = null
  var bd := 1e9
  for p in players:
    if p.state == "dead":
      continue
    var d: float = absf(p.x - e.x) + absf(p.y - e.y) * 2.0
    if d < bd:
      bd = d
      b = p
  return b

func update_enemy(e: Dictionary) -> void:
  var Dd: Dictionary = e.def
  if e.flash > 0:
    e.flash -= 1
  if e.cool > 0.0:
    e.cool -= 1.0
  if e.invuln > 0:
    e.invuln -= 1
  if e.chainT > 0:
    e.chainT -= 1
    if e.chainT == 0:
      e.hitChain = 0
  match e.state:
    "spawn":
      var tx := 1 if e.face > 0 else -1
      e.vx = tx * 1.6
      e.vy = 0.0
      e.x += e.vx
      set_anim(e, "walk")
      walk_phase(e)
      if e.x > cam_x + 26.0 and e.x < cam_x + GW - 26.0:
        e.state = "idle"
    "idle", "retreat":
      ai_think(e)
    "attack":
      ai_attack(e)
    "charge":
      ai_charge(e)
    "tired":
      e.tiredT -= 1
      set_anim(e, "idle")
      advance(e, true, 1.0)
      if e.tiredT <= 0:
        e.state = "idle"
    "hit":
      advance(e, false, 1.0)
      e.x += e.vx
      e.vx *= 0.85
      e.stun -= 1
      if e.stun <= 0:
        e.state = "idle"
        set_anim(e, "idle")
    "knock":
      knock_step(e)
    "down":
      down_step(e, 50 if e.boss else 44)
    "getup":
      advance(e, false, 1.0)
      if e.done:
        e.state = "idle"
        set_anim(e, "idle")
        e.cool = 20.0
    "dead":
      dead_step(e)
    "held":
      e.anim = "held"
      e.frame = 0
      if e.heldBy == null:
        e.state = "idle"
        e.cool = 30.0
  if not (e.state in ["knock", "down", "dead", "spawn"]):
    e.x = clampf(e.x, cam_x - 40.0, cam_x + GW + 40.0)
    e.y = clampf(e.y, FT, FB)
  if e.state == "idle" and Dd.has("summonAt") and not e.summoned and e.hp < e.maxhp * float(Dd.summonAt) and e.cool <= 0.0:
    e.summoned = true
    start_enemy_attack(e, "summon")

func update_tokens() -> void:
  if players.is_empty() or stage.is_empty():
    return
  var pl: Dictionary = players[0]
  var grunts: Array = enemies.filter(func(e): return not e.boss and not e.remove and not (e.state in ["dead", "down", "knock", "spawn", "held", "getup"]))
  var busy := func(e): return e.state == "attack" or e.state == "charge"
  for e in grunts:
    if not busy.call(e):
      e.token = false
  var nbusy := 0
  for e in grunts:
    if busy.call(e):
      nbusy += 1
  var free: int = int(stage.tokens) - nbusy
  var idle_list: Array = grunts.filter(func(e): return not busy.call(e))
  idle_list.sort_custom(func(a, b): return absf(a.x - pl.x) < absf(b.x - pl.x))
  for i in range(min(max(0, free), idle_list.size())):
    idle_list[i].token = true

func ai_think(e: Dictionary) -> void:
  var p = nearest_player(e)
  var Dd: Dictionary = e.def
  if p == null:
    set_anim(e, "idle")
    advance(e, true, 1.0)
    return
  var dx: float = p.x - e.x
  var dy: float = p.y - e.y
  var adx := absf(dx)
  var ady := absf(dy)
  if adx > 3.0:
    e.face = 1 if dx > 0.0 else -1
  var tvx := 0.0
  var tvy := 0.0
  var spd: float = Dd.spd
  var lane := func(ty: float, k := 1.0) -> float:
    var d: float = ty - e.y
    return clampf(d * 0.2, -spd * 0.8, spd * 0.8) * (0.0 if absf(d) < 2.0 else 1.0) * k
  if e.state == "retreat" or e.retreat > 0:
    e.state = "retreat"
    e.retreat -= 1
    tvx = -e.face * spd * 0.9
    tvy = lane.call(p.y + e.laneOff * 0.5)
    if e.retreat <= 0:
      e.state = "idle"
  elif e.token or e.boss:
    if e.cool > 0.0:
      var ring := 66.0 if e.boss else 62.0
      if adx > ring + 8.0:
        tvx = e.face * spd * 0.7
      elif adx < ring - 14.0:
        tvx = -e.face * spd * 0.6
      tvy = lane.call(p.y + e.laneOff * 0.3, 0.7)
    else:
      if e.next == "":
        e.next = Dd.moves[randi() % Dd.moves.size()]
      var mv: Dictionary = D.EM[e.next]
      var kind: String = mv.get("kind", "melee")
      if kind == "ranged":
        if adx >= 70.0 and adx <= 170.0 and ady < 8.0:
          start_enemy_attack(e, e.next)
          return
        if adx < 70.0:
          tvx = -e.face * spd
        elif adx > 170.0:
          tvx = e.face * spd
        tvy = lane.call(p.y)
      elif kind == "charge":
        if adx >= 80.0 and adx <= 230.0 and ady < 8.0:
          start_enemy_attack(e, e.next)
          return
        if adx < 80.0:
          tvx = -e.face * spd
        else:
          tvx = e.face * spd * 0.8
        tvy = lane.call(p.y)
      elif kind == "summon":
        start_enemy_attack(e, e.next)
        return
      else:
        if adx <= float(mv.engage) and ady <= 6.0:
          start_enemy_attack(e, e.next)
          return
        if adx > float(mv.engage) - 4.0:
          tvx = e.face * spd
        tvy = lane.call(p.y)
  else:
    var ring2: float = e.ring
    if adx > ring2 + 14.0:
      tvx = e.face * spd * 0.85
    elif adx < ring2 - 18.0:
      tvx = -e.face * spd * 0.7
    tvy = lane.call(p.y + e.laneOff, 0.8)
  e.vx += (tvx - e.vx) * 0.3
  e.vy += (tvy - e.vy) * 0.3
  if absf(e.vx) < 0.03:
    e.vx = 0.0
  if absf(e.vy) < 0.03:
    e.vy = 0.0
  e.x += e.vx
  e.y += e.vy
  if Vector2(e.vx, e.vy).length() > 0.25:
    set_anim(e, "walk")
    walk_phase(e)
  else:
    set_anim(e, "idle")
    advance(e, true, 1.0)

func start_enemy_attack(e: Dictionary, name: String) -> void:
  var mv: Dictionary = D.EM[name]
  e.state = "attack"
  e.atk = {"name": name, "mv": mv, "phase": "windup", "t": 0, "hitSet": [], "fired": false, "swung": false}
  e.vx = 0.0
  e.vy = 0.0
  restart_anim(e, mv.anim)
  e.armor = mv.get("armor", false)
  e.next = ""
  e.warn = true
  e.windScale = 0.7 if (e.boss and e.hp < e.maxhp * 0.35) else 1.0
  play("warn")

func ai_attack(e: Dictionary) -> void:
  var a = e.atk
  if a == null:
    e.state = "idle"
    return
  var mv: Dictionary = a.mv
  if a.phase == "windup":
    a.t += 1
    e.frame = 0
    e.ft = 0.0
    var p = nearest_player(e)
    if p != null and a.t < mv.windup * 0.5:
      e.face = 1 if p.x >= e.x else -1
    if a.t >= mv.windup * e.windScale:
      e.warn = false
      var kind: String = mv.get("kind", "melee")
      if kind == "charge":
        e.state = "charge"
        e.ct = 0
        e.hitSet = []
        set_anim(e, "run")
        e.armor = true
        return
      if kind == "summon":
        do_summon(e)
        a.phase = "recover"
        a.t = 0
        return
      a.phase = "strike"
      e.frame = 1
      e.ft = 0.0
    return
  if a.phase == "recover":
    a.t += 1
    if a.t > 40:
      end_enemy_attack(e)
    return
  advance(e, false, 1.0)
  if mv.get("kind", "melee") == "ranged":
    if e.frame >= int(mv.hit[0]) and not a.fired:
      a.fired = true
      fire_proj(e, mv)
  elif _inl(mv.hit, e.frame):
    if not a.swung:
      a.swung = true
      play("swing")
    strike(e, mv.box, mv, a.hitSet)
  if e.done:
    end_enemy_attack(e)

func end_enemy_attack(e: Dictionary) -> void:
  var a = e.atk
  var mv = a.mv if a != null else null
  e.atk = null
  e.armor = false
  e.warn = false
  e.state = "idle"
  set_anim(e, "idle")
  e.cool = float(mv.cool) * (0.65 if (e.boss and e.hp < e.maxhp * 0.35) else 1.0) if mv != null else 40.0
  if mv != null and mv.has("chain") and randf() < 0.8:
    var p = nearest_player(e)
    if p != null and absf(p.x - e.x) < 50.0:
      start_enemy_attack(e, mv.chain)
      return
  if e.def.get("retreat", false):
    e.retreat = 36
    e.state = "retreat"

func ai_charge(e: Dictionary) -> void:
  var mv: Dictionary = e.atk.mv
  e.ct += 1
  e.x += e.face * float(mv.speed)
  set_anim(e, "run")
  e.phase += float(mv.speed) / 56.0
  e.phase = fposmod(e.phase, 1.0)
  e.frame = floori(e.phase * 6.0) % 6
  var hit := strike(e, mv.box, mv, e.hitSet)
  var edge_hit: bool = (e.x < cam_x + 10.0 and e.face < 0) or (e.x > cam_x + GW - 10.0 and e.face > 0)
  if e.ct > int(mv.dur) or hit or edge_hit:
    e.atk = null
    e.armor = false
    e.state = "tired"
    e.tiredT = 20 if hit else 44
    e.cool = float(mv.cool)
    e.vx = 0.0

func do_summon(_e: Dictionary) -> void:
  play("go")
  for q in [["guard", -1], ["exec", 1]]:
    var n := make_enemy(q[0], cam_x - 24.0 if q[1] < 0 else cam_x + GW + 24.0, rnd(FT + 6.0, FB - 6.0))
    n.face = 1 if q[1] < 0 else -1
    enemies.append(n)
  flash_t = 6

func fire_proj(e: Dictionary, mv: Dictionary) -> void:
  play("throw")
  var cnt := int(mv.count)
  for i in cnt:
    projs.append({"x": e.x + e.face * 18.0, "y": e.y + (i - (cnt - 1) / 2.0) * 12.0, "z": 32.0 + e.z, "vx": e.face * 2.4, "life": 160, "dmg": float(mv.dmg), "spin": 0})

func update_proj(pr: Dictionary) -> void:
  pr.x += pr.vx
  pr.life -= 1
  pr.spin += 1
  if pr.x < cam_x - 30.0 or pr.x > cam_x + GW + 30.0:
    pr.life = 0
  for p in players:
    if not can_be_hit(p):
      continue
    if absf(p.x - pr.x) < p.hw + 4.0 and absf(p.y - pr.y) < 9.0 and pr.z > p.z and pr.z < p.z + p.ht:
      pr.life = 0
      var fake := {"id": -1, "x": pr.x - signf(pr.vx) * 20.0, "face": int(signf(pr.vx)), "z": 0.0, "team": "e"}
      hurt(p, fake, {"dmg": pr.dmg, "kb": 1.5, "stun": 16, "hs": 3, "box": {"z0": 20.0, "z1": 40.0}})

func separate() -> void:
  var L: Array = []
  for o in players + enemies:
    if not (o.state in ["knock", "down", "dead", "held", "spawn"]) and o.z < 4.0:
      L.append(o)
  for i in L.size():
    for j in range(i + 1, L.size()):
      var a: Dictionary = L[i]
      var b: Dictionary = L[j]
      var rx: float = (a.hw + b.hw) * 0.9
      var dx: float = b.x - a.x
      var dy: float = b.y - a.y
      var nx := dx / rx
      var ny := dy / 10.0
      var d2 := nx * nx + ny * ny
      if d2 >= 1.0:
        continue
      var d := maxf(sqrt(d2), 0.01)
      var m := (1.0 - d) * 0.9
      var wa := 0.3 if a.team == "p" else 1.0
      var wb := 0.3 if b.team == "p" else 1.0
      var jx := rnd(-1, 1) if d < 0.05 else 0.0
      var jy := rnd(-1, 1) if d < 0.05 else 0.0
      var ux: float = (nx / d) if absf(nx / d) > 0.0 else jx
      var uy: float = (ny / d) if absf(ny / d) > 0.0 else jy
      a.x -= ux * m * wa * (rx / 14.0)
      b.x += ux * m * wb * (rx / 14.0)
      a.y -= uy * m * wa * 0.5
      b.y += uy * m * wb * 0.5

# ---------------------------------------------------------------- items / particles / waves / camera
func pickup_check(p: Dictionary) -> void:
  if p.state == "dead" or p.state == "down" or p.z > 10.0:
    return
  for it in items:
    if it.taken or it.z > 6.0:
      continue
    if absf(it.x - p.x) < 15.0 and absf(it.y - p.y) < 11.0:
      it.taken = true
      var f: Dictionary = D.FOOD[it.type]
      p.hp = min(p.maxhp, p.hp + float(f.heal))
      score += 100
      play("pick")
      parts.append({"type": "plate", "x": it.x, "y": it.y, "z": 8.0, "vz": 0.5, "life": 40, "age": 0})
      parts.append({"type": "glow", "x": it.x, "y": it.y, "z": 14.0, "life": 18, "age": 0})
      parts.append({"type": "text", "x": it.x, "y": it.y, "z": 26.0, "vz": 0.6, "life": 56, "age": 0, "s": "+100"})
      for i in 6:
        parts.append({"type": "sparkle", "x": it.x + rnd(-14, 14), "y": it.y, "z": rnd(4, 24), "vz": rnd(0.2, 0.8), "life": int(rnd(16, 30)), "age": 0})

func update_items() -> void:
  for it in items:
    it.t += 1
    it.life -= 1
    if it.z > 0.0 or it.get("vz", 0.0) != 0.0:
      it.vz = it.get("vz", 0.0) - 0.2
      it.z += it.vz
      if it.z <= 0.0:
        it.z = 0.0
        it.vz = 0.0
  items = items.filter(func(i): return not i.taken and i.life > 0)

func spark(x: float, y: float, z: float, big: int) -> void:
  parts.append({"type": "boom" if big == 1 else "spark", "x": x, "y": y, "z": z, "life": 14 if big == 1 else 9, "age": 0})

func dust(x: float, y: float, n: int) -> void:
  for i in n:
    parts.append({"type": "dust", "x": x + rnd(-10, 10), "y": y + 1.0, "z": 2.0, "vx": rnd(-0.5, 0.5), "vz": rnd(0.1, 0.4), "life": 20, "age": 0})

func update_parts() -> void:
  for p in parts:
    p.age += 1
    p.life -= 1
    if p.has("vx"):
      p.x += p.vx
    if p.has("vy"):
      p.y += p.vy
    if p.has("vz"):
      p.z += p.vz
      if p.type == "debris":
        p.vz -= 0.22
        if p.z < 0.0:
          p.z = 0.0
          p.vz = 0.0
          p.vx *= 0.5
  parts = parts.filter(func(p): return p.life > 0)

func spawn_enemy(type: String, side: String) -> Dictionary:
  var x := cam_x + GW + 26.0 if side == "R" else cam_x - 26.0
  var e := make_enemy(type, x, rnd(FT + 8.0, FB - 8.0))
  e.face = -1 if side == "R" else 1
  enemies.append(e)
  return e

func update_waves() -> void:
  if stage.is_empty():
    return
  for q in spawn_q:
    q.t -= 1
  for q in spawn_q.filter(func(q): return q.t <= 0):
    spawn_enemy(q.type, q.side)
  spawn_q = spawn_q.filter(func(q): return q.t > 0)
  var w = stage.waves[wave_idx] if wave_idx < stage.waves.size() else null
  if wave_state == "walk" and w != null and cam_x >= float(w.x) - 2.0:
    wave_state = "fight"
    cam_max = float(w.x)
    for q in w.e:
      spawn_q.append({"type": q[0], "side": q[1], "t": int(q[2]) if q.size() > 2 else int(rnd(0, 70))})
    if w.get("boss", false):
      boss_banner = 150
      play("go")
      items.append({"type": "spit", "x": float(w.x) + 60.0, "y": 190.0, "z": 0.0, "life": 6000, "t": 0, "taken": false})
  elif wave_state == "fight" and spawn_q.is_empty() and enemies.all(func(e): return e.state == "dead"):
    wave_state = "walk"
    wave_idx += 1
    go_t = 0
    if wave_idx >= stage.waves.size():
      cam_max = float(stage.len) - GW
      clear_t = 1
    else:
      cam_max = float(stage.waves[wave_idx].x)
      play("go")
  if clear_t > 0:
    clear_t += 1
    var p: Dictionary = players[0]
    if clear_t == 20 and p.state != "dead":
      p.state = "win"
      restart_anim(p, "win")
      p.vx = 0.0
      p.vy = 0.0
    if clear_t > 190:
      finish_stage()
  if boss_banner > 0:
    boss_banner -= 1
  if wave_state == "walk":
    go_t += 1

func finish_stage() -> void:
  var p: Dictionary = players[0]
  carry = {"hp": p.hp, "hype": p.hype}
  lives = max(lives, 1)
  state = "victory" if stage_idx >= D.STAGES.size() - 1 else "stageclear"
  best = max(best, score)
  clear_t = 0
  play("go")

func update_camera() -> void:
  if players.is_empty():
    return
  var p: Dictionary = players[0]
  var target: float = p.x - GW * 0.42 + p.face * 14.0
  var nx: float = cam_x + clampf((target - cam_x) * 0.1, -4.0, 4.0)
  cam_x = clampf(maxf(cam_x, nx), 0.0, cam_max)

# ---------------------------------------------------------------- menus
func update_menus() -> void:
  match state:
    "title":
      if just("start") or just("attack") or just("jump"):
        state = "select"
        play("ui")
    "select":
      var ids: Array = D.players
      if just("left"):
        sel = (sel + 2) % 3
        play("ui")
      if just("right"):
        sel = (sel + 1) % 3
        play("ui")
      if just("start") or just("attack"):
        start_run(ids[sel])
        play("go")
      if just("pause") or just("back"):
        state = "title"
    "pause":
      if just("up"):
        menu = (menu + 3) % 4
      if just("down"):
        menu = (menu + 1) % 4
      if just("pause"):
        state = "play"
        return
      if just("start") or just("attack"):
        pause_choose(menu)
    "gameover":
      if just("start") or just("attack"):
        lives = 3
        score = 0
        carry = null
        start_stage(stage_idx)
      if just("pause") or just("back"):
        state = "title"
    "stageclear":
      if just("start") or just("attack"):
        start_stage(stage_idx + 1)
        play("go")
    "victory":
      if just("start") or just("attack"):
        state = "title"

func pause_choose(i: int) -> void:
  if i == 0:
    state = "play"
  elif i == 1:
    lives = 3
    carry = null
    start_stage(stage_idx)
  elif i == 2:
    show_help = not show_help
  else:
    state = "title"
  play("ui")
