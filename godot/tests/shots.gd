extends SceneTree
## Renders real frames through Godot's renderer:  xvfb-run -a godot --path godot --rendering-driver opengl3 --script res://tests/shots.gd
var g
func shot(name: String) -> void:
  await process_frame
  await process_frame
  var img: Image = root.get_viewport().get_texture().get_image()
  img.resize(768, 432, Image.INTERPOLATE_NEAREST)
  img.save_png("res://../shots_godot/%s.png" % name)
func _initialize() -> void:
  g = load("res://scripts/game.gd").new()
  g.use_real_input = false
  root.add_child(g)
  await process_frame
  await process_frame
  g.state = "title"
  g.t = 40
  await shot("g01_title")
  g.state = "select"
  await shot("g02_select")
  g.clear_input()
  g.start_run("ricky")
  g.start_stage(0)
  var p = g.players[0]
  p.invuln = 0
  g.banner = 0
  p.x = 130.0
  g.cam_x = 70.0
  var a = g.make_enemy("exec", 200.0, 175.0)
  var b = g.make_enemy("guard", 250.0, 160.0)
  a.state = "idle"
  b.state = "idle"
  a.cool = 999.0
  b.cool = 999.0
  g.enemies.append(a)
  g.enemies.append(b)
  g.items.append({"type": "adana", "x": 170.0, "y": 190.0, "z": 0.0, "life": 900, "t": 5, "taken": false})
  g.items.append({"type": "shish", "x": 330.0, "y": 150.0, "z": 0.0, "life": 900, "t": 30, "taken": false})
  await shot("g03_stage1")
  g.clear_input()
  g.start_run("vv")
  g.start_stage(2)
  p = g.players[0]
  p.invuln = 0
  g.banner = 0
  p.x = 150.0
  p.y = 172.0
  g.cam_x = 90.0
  p.hype = 80.0
  for i in 3:
    var e = g.make_enemy("raider", 175.0 + i * 22.0, 160.0 + i * 12.0)
    e.state = "idle"
    e.cool = 999.0
    e.hp = 500.0
    e.maxhp = 500.0
    g.enemies.append(e)
  g.set_btn("special", true)
  for i in 20:
    g.update()
  await shot("g04_vv_special")
  g.set_btn("special", false)
  g.clear_input()
  g.start_run("johnny")
  g.start_stage(1)
  p = g.players[0]
  p.invuln = 0
  g.banner = 0
  p.x = 150.0
  p.y = 172.0
  g.cam_x = 90.0
  var t = g.make_enemy("bigtony", 235.0, 172.0)
  t.state = "idle"
  t.cool = 999.0
  t.hp = 200.0
  g.enemies.append(t)
  g.combo = {"n": 5, "t": 90, "pop": 0.0}
  g.score = 4200
  await shot("g05_boss_hud")
  g.state = "pause"
  g.show_help = true
  g.menu = 2
  await shot("g06_pause")
  quit(0)
