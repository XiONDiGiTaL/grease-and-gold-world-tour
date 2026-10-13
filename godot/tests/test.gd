extends SceneTree
## Headless checks for the Godot port:  godot --headless --path godot --script res://tests/test.gd
var g
var passed := 0
var failed := 0

func ok(c: bool, name: String, info = "") -> void:
  if c:
    passed += 1
    print("PASS ", name)
  else:
    failed += 1
    print("FAIL ", name, " -> ", info)

func step(n := 1) -> void:
  for i in n:
    g.update()
func press(b: String, hold := 1) -> void:
  g.set_btn(b, true)
  step(hold)
  g.set_btn(b, false)
func fresh(ch := "ricky", god := false):
  g.clear_input()
  g.god_mode = god
  g.start_run(ch)
  g.players[0].invuln = 0
  return g.players[0]
func put(type: String, dx: float, dy: float, st := "idle") -> Dictionary:
  var p = g.players[0]
  var e = g.make_enemy(type, p.x + dx, p.y + dy)
  e.state = st
  e.cool = 9999.0
  e.face = -1 if dx > 0 else 1
  g.enemies.append(e)
  return e

func _initialize() -> void:
  g = load("res://scripts/game.gd").new()
  g.use_real_input = false
  root.add_child(g)
  await process_frame
  await process_frame
  g.state = "title"
  print("== data / assets")
  var D = g.D
  ok(D.players.size() == 3 and D.enemies.size() == 9, "3 players + 9 enemy kits in data")
  var bad := []
  for id in D.players + D.enemies:
    var tex: Texture2D = load("res://assets/sprites/%s.png" % id)
    if tex == null or tex.get_width() != 8 * int(D.cell):
      bad.append(id)
    for a in D.atlas[id]:
      if not g.TIMING.has(a) or int(D.atlas[id][a].n) != g.TIMING[a].size():
        bad.append(id + ":" + a)
      if (int(D.atlas[id][a].row) + 1) * int(D.cell) > tex.get_height():
        bad.append(id + ":" + a + ":row")
  ok(bad.is_empty(), "every sprite sheet loads, is 8 columns of 112px, and atlas frame counts match animation timing", bad)
  ok(g.renderer != null and g.renderer.sheets.size() == 12 and g.renderer.bgs.size() == 4, "renderer loaded all sheets and 4 stage backdrops")
  print("== gameplay")
  var p = fresh("ricky")
  p.x = 120.0
  g.cam_x = 60.0
  var x0: float = p.x
  var ph0: float = p.phase
  var total := 0.0
  var last: float = p.phase
  g.set_btn("right", true)
  for i in 60:
    step()
    var d: float = p.phase - last
    if d < -0.5:
      d += 1.0
    total += d
    last = p.phase
  g.set_btn("right", false)
  ok(p.x - x0 > 60.0, "holding right moves the fighter", p.x - x0)
  ok(absf(total * p.stride - (p.x - x0)) < 6.0, "walk-cycle phase advances with distance travelled (no foot sliding)", [total * p.stride, p.x - x0])
  p = fresh("vv")
  p.x = 150.0
  g.cam_x = 90.0
  var y0: float = p.y
  var peak := 0.0
  press("jump")
  for i in 50:
    step()
    peak = maxf(peak, p.z)
  ok(peak > 38.0 and peak < 52.0, "jump apex ~44px", peak)
  ok(absf(p.y - y0) < 0.01, "jump leaves ground-plane lane unchanged")
  ok(p.z == 0.0, "lands at z=0")
  # combo
  p = fresh("ricky")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  var e = put("exec", 40, 0)
  e.hp = 500.0
  e.maxhp = 500.0
  var max_step := -1
  var seen := {}
  press("attack")
  for i in 70:
    if i == 6 or i == 17:
      press("attack")
    else:
      step()
    if p.state == "attack":
      max_step = maxi(max_step, p.step)
    seen[e.state] = true
  ok(max_step == 2, "taps chain into buffered 3-hit combo", max_step)
  ok(seen.has("knock") or seen.has("down"), "finisher knocks down", seen.keys())
  # lane / direction
  p = fresh("ricky")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  var a = put("exec", 40, 0)
  var b = put("exec", 40, 32)
  var c = put("exec", -40, 0)
  var f = put("exec", 90, 0)
  for q in [a, b, c, f]:
    q.hp = 90.0
  press("attack")
  step(20)
  ok(a.hp < 90.0, "in-lane enemy in front is hit")
  ok(b.hp == 90.0, "other-lane enemy not hit", b.hp)
  ok(c.hp == 90.0, "enemy behind not hit", c.hp)
  ok(f.hp == 90.0, "out-of-reach enemy not hit")
  # hitstop
  p = fresh("johnny")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  e = put("exec", 36, 0)
  e.hp = 200.0
  press("attack")
  var hs := 0
  for i in 40:
    step()
    hs = maxi(hs, g.hitstop)
  ok(hs > 0 and hs <= 9, "hit-stop brief (<=9 ticks)", hs)
  # hype
  p = fresh("vv")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  for i in 4:
    var h = put("heavy", 24 + i * 6, (i - 1.5) * 4)
    h.hp = 900.0
    h.maxhp = 900.0
  p.hype = 50.0
  var h0: float = p.hype
  g.set_btn("special", true)
  step(2)
  ok(p.state == "special", "special starts with HYPE")
  var rose := false
  var prev: float = p.hype
  for i in 60:
    step()
    if p.hype > prev + 1e-9:
      rose = true
    prev = p.hype
  ok(not rose, "special damage grants no HYPE")
  ok(h0 - p.hype > 10.0 and h0 - p.hype < 25.0, "HYPE drains while held", h0 - p.hype)
  g.set_btn("special", false)
  step(2)
  var hr: float = p.hype
  step(30)
  ok(p.state != "special" and absf(p.hype - hr) < 1e-9, "release stops special and drain")
  p = fresh("ricky")
  g.enemies = []
  p.hype = 1.0
  p.x = 150.0
  g.cam_x = 90.0
  g.set_btn("special", true)
  step(12)
  ok(p.state != "special" and p.hype == 0.0, "special stops at 0 HYPE", [p.state, p.hype])
  g.set_btn("special", false)
  p = fresh("ricky")
  g.enemies = []
  p.hype = 0.0
  p.x = 150.0
  g.cam_x = 90.0
  e = put("exec", 40, 0)
  e.hp = 300.0
  press("attack")
  step(15)
  ok(p.hype > 0.0, "ordinary hits restore HYPE", p.hype)
  # grab / throw
  p = fresh("johnny")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  e = put("exec", 22, 0)
  e.hp = 120.0
  e.maxhp = 120.0
  var hp0: float = e.hp
  press("grab")
  step(2)
  ok(p.state == "grab" and e.state == "held", "grab latches")
  press("attack")
  step(14)
  ok(e.hp < hp0, "grab strike damages", e.hp)
  var hp1: float = e.hp
  g.set_btn("right", true)
  press("grab")
  g.set_btn("right", false)
  step(6)
  ok((e.state == "knock" and e.thrown) or e.state == "down", "throw launches", e.state)
  step(40)
  ok(e.hp < hp1, "throw deals damage")
  p = fresh("johnny")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  put("exec", 22, 0)
  var o = put("exec", 70, 0)
  o.hp = 100.0
  o.maxhp = 100.0
  press("grab")
  step(2)
  press("grab")
  step(50)
  ok(o.hp < 100.0, "thrown enemy bowls into others", o.hp)
  # props
  p = fresh("ricky")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  g.props = [{"id": 9001, "kind": "prop", "type": "crate", "x": 186.0, "y": p.y, "z": 0.0, "hp": 4.0, "hw": 12.0, "hd": 9.0, "ht": 26.0, "shake": 0, "remove": false}]
  seed(7)
  var dropped := false
  for i in 12:
    p.x = 150.0
    g.cam_x = 90.0
    press("attack")
    step(16)
    if g.items.size() > 0:
      dropped = true
    if g.props.is_empty():
      break
  ok(g.props.is_empty(), "crate destructible")
  var any_item: bool = g.items.size() > 0 or dropped
  if not any_item:
    # drop is 70% random; retry on a few more crates
    for k in 6:
      g.props = [{"id": 9100 + k, "kind": "prop", "type": "barrel", "x": 186.0, "y": p.y, "z": 0.0, "hp": 1.0, "hw": 12.0, "hd": 9.0, "ht": 26.0, "shake": 0, "remove": false}]
      p.x = 150.0
      g.cam_x = 90.0
      press("attack")
      step(16)
      if g.items.size() > 0:
        any_item = true
        break
  ok(any_item, "broken props drop food")
  if g.items.size() > 0:
    var it = g.items[0]
    p.hp = 40.0
    p.x = it.x - 2.0
    p.y = it.y
    g.cam_x = maxf(0.0, p.x - 150.0)
    step(60)
    ok(p.hp > 40.0, "food heals", p.hp)
  # poise-armoured enemy hit by a knock move must recover (regression)
  p = fresh("ricky")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  var hv = put("heavy", 36, 0)
  hv.hp = 900.0
  hv.maxhp = 900.0
  hv.poise = 999.0
  g.hurt(hv, p, {"dmg": 1.0, "knock": true, "launch": 2.0, "kb": 2.0, "hs": 0, "box": {"z0": 10.0, "z1": 40.0}})
  step(60)
  ok(hv.state == "idle", "heavy hit by knock move without poise break recovers from hit-stun", hv.state)
  # separation
  p = fresh("ricky")
  g.enemies = []
  p.x = 200.0
  g.cam_x = 150.0
  for i in 5:
    var s = put("guard", -60, 0)
    s.x = 120.0
    s.y = 170.0
  step(90)
  var mn := 1e9
  for i in g.enemies.size():
    for j in range(i + 1, g.enemies.size()):
      var A = g.enemies[i]
      var B = g.enemies[j]
      mn = minf(mn, Vector2((A.x - B.x) / ((A.hw + B.hw) * 0.9), (A.y - B.y) / 10.0).length())
  ok(mn > 0.8, "crowd separation (no body overlap)", mn)
  # life loss
  p = fresh("ricky")
  g.enemies = []
  p.x = 150.0
  g.cam_x = 90.0
  p.hp = 1.0
  e = put("exec", 30, 0)
  e.cool = 0.0
  e.token = true
  var died := false
  for i in 400:
    step()
    e.token = true
    if g.lives < 3:
      died = true
      break
  ok(died and p.hp == p.maxhp, "losing HP costs a life and respawns", g.lives)
  # NaN
  p = fresh("vv")
  var ids := ["guard", "exec", "heavy", "brawler", "raider"]
  for i in 12:
    g.spawn_enemy(ids[i % 5], "R" if i % 2 == 1 else "L")
  for i in 600:
    g.set_btn("attack", i % 7 < 2)
    g.set_btn("right", i % 90 < 45)
    g.set_btn("up", i % 50 < 20)
    if i % 130 == 0:
      press("jump")
    step()
  g.clear_input()
  var fine := true
  for q in g.players + g.enemies:
    if is_nan(q.x) or is_nan(q.y) or is_nan(q.z) or is_nan(q.hp):
      fine = false
  ok(fine, "no NaN after chaotic input")
  print("== stage flow (god-mode bot)")
  for si in 4:
    p = fresh("ricky", true)
    g.start_stage(si)
    g.lives = 3
    p = g.players[0]
    var ticks := 0
    var cleared := false
    var saw_fight := false
    var boss_seen := false
    var viol := 0
    while ticks < 60 * 60 * 9:
      ticks += 1
      var live: Array = g.enemies.filter(func(q): return q.state != "dead" and q.state != "spawn" and not q.remove)
      live.sort_custom(func(m, n): return absf(m.x - p.x) < absf(n.x - p.x))
      for bn in ["left", "right", "up", "down"]:
        g.set_btn(bn, false)
      if g.items.size() > 0 and p.hp < p.maxhp * 0.6:
        var it2 = g.items[0]
        g.set_btn("right" if it2.x > p.x + 3.0 else "left", absf(it2.x - p.x) > 3.0)
        g.set_btn("down" if it2.y > p.y + 2.0 else "up", absf(it2.y - p.y) > 2.0)
      elif live.size() > 0:
        var tg = live[0]
        var dx: float = tg.x - p.x
        if absf(dx) > 34.0:
          g.set_btn("right" if dx > 0 else "left", true)
        elif absf(dx) < 16.0:
          g.set_btn("left" if dx > 0 else "right", true)
        if absf(tg.y - p.y) > 3.0:
          g.set_btn("down" if tg.y > p.y else "up", true)
        g.set_btn("attack", absf(dx) < 60.0 and ticks % 6 < 2)
        g.set_btn("special", p.hype > 70.0 and absf(dx) < 40.0)
        if p.state == "special" and p.hype < 20.0:
          g.set_btn("special", false)
      else:
        g.set_btn("right", true)
      g.update()
      if g.wave_state == "fight":
        saw_fight = true
      for q in g.enemies:
        if q.boss:
          boss_seen = true
      if g.cam_x > g.cam_max + 0.5:
        viol += 1
      if g.state == "stageclear" or g.state == "victory":
        cleared = true
        break
      if g.state == "gameover":
        break
    g.clear_input()
    ok(cleared, "stage %d (%s) completable" % [si + 1, g.D.STAGES[si].name], [ticks, g.state, g.wave_idx])
    ok(saw_fight and boss_seen, "stage %d waves lock + boss appears" % (si + 1))
    ok(viol == 0, "stage %d camera never passes wave lock" % (si + 1), viol)
  print("\n%d passed, %d failed" % [passed, failed])
  quit(1 if failed > 0 else 0)
