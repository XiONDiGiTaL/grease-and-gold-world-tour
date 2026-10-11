extends Control

var player: CharacterBody2D
var stage: Node2D
var intro_timer := 3.2

func set_player(value: CharacterBody2D) -> void:
	player = value

func set_stage(value: Node2D) -> void:
	stage = value

func _process(delta: float) -> void:
	intro_timer = maxf(0.0, intro_timer - delta)
	queue_redraw()

func _draw() -> void:
	if player == null:
		return

	# Framed hero portrait
	draw_rect(Rect2(9, 9, 52, 52), Color("171422"), true)
	draw_rect(Rect2(10, 10, 50, 50), Color("e8b857"), false, 2.0)
	draw_circle(Vector2(35, 29), 12, Color("d69465"))
	draw_rect(Rect2(23, 16, 22, 8), Color("1c1a24"), true)
	draw_rect(Rect2(27, 27, 16, 3), Color("3b2528"), true)
	draw_rect(Rect2(23, 24, 22, 4), Color("b98342"), true)
	draw_rect(Rect2(23, 25, 7, 2), Color("2b2430"), true)
	draw_rect(Rect2(38, 25, 7, 2), Color("2b2430"), true)
	draw_rect(Rect2(22, 41, 26, 15), Color("ae7d4f"), true)
	draw_rect(Rect2(26, 42, 18, 14), Color("26242d"), true)

	# Status panel
	draw_rect(Rect2(67, 10, 241, 52), Color("11101a"), true)
	draw_rect(Rect2(67, 10, 241, 52), Color("6e4f2c"), false, 2.0)
	draw_string(ThemeDB.fallback_font, Vector2(74, 16), "RICKY B", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("f7d47a"))

	var health_ratio := clampf(float(player.health) / float(player.max_health), 0.0, 1.0)
	var hype_ratio := clampf(player.hype / player.max_hype, 0.0, 1.0)
	_bar(Rect2(74, 30, 226, 11), health_ratio, Color("52cf72"), Color("3d2a35"))
	_bar(Rect2(74, 46, 226, 7), hype_ratio, Color("ad67ee"), Color("3c345b"))
	draw_string(ThemeDB.fallback_font, Vector2(74, 42), "HP", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("1e1923"))
	draw_string(ThemeDB.fallback_font, Vector2(74, 54), "HYPE", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("ece1ff"))

	# Right-side stage information
	draw_rect(Rect2(330, 10, 140, 52), Color("11101a"), true)
	draw_rect(Rect2(330, 10, 140, 52), Color("6e4f2c"), false, 2.0)
	draw_string(ThemeDB.fallback_font, Vector2(342, 16), "STAGE 1: G&G HQ", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("fff0bd"))
	draw_string(ThemeDB.fallback_font, Vector2(342, 32), "LIVES  x3", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("ffffff"))
	draw_string(ThemeDB.fallback_font, Vector2(342, 47), "SCORE  000000", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("f0c657"))

	if stage != null and stage.encounter_locked:
		draw_rect(Rect2(155, 72, 170, 21), Color(0.08, 0.06, 0.12, 0.88), true)
		draw_rect(Rect2(155, 72, 170, 21), Color("b58543"), false, 1.0)
		draw_string(ThemeDB.fallback_font, Vector2(176, 78), "STREET LOCKED — CLEAR WAVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color("ffdc73"))
	elif stage != null and stage.active_wave > 0:
		draw_string(ThemeDB.fallback_font, Vector2(425, 230), "GO  >>", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("8dff89"))

	if intro_timer > 0.0:
		var alpha := minf(intro_timer, 1.0)
		draw_rect(Rect2(111, 106, 258, 50), Color(0.04, 0.03, 0.08, alpha * 0.88), true)
		draw_rect(Rect2(111, 106, 258, 50), Color(0.84, 0.62, 0.27, alpha), false, 2.0)
		draw_string(ThemeDB.fallback_font, Vector2(155, 117), "STAGE 1", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 0.86, 0.48, alpha))
		draw_string(ThemeDB.fallback_font, Vector2(130, 136), "GREASE & GOLD HEADQUARTERS", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1, 1, 1, alpha))

	draw_string(ThemeDB.fallback_font, Vector2(12, 261), "WASD / ARROWS: MOVE     Z: FLAG ATTACK     X: SPECIAL     SPACE: JUMP", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("cbbdba"))

func _bar(rect: Rect2, ratio: float, fill: Color, back: Color) -> void:
	draw_rect(rect, Color("090812"), true)
	draw_rect(rect.grow(-1), back, true)
	var inner := Rect2(rect.position + Vector2(2, 2), Vector2((rect.size.x - 4) * ratio, rect.size.y - 4))
	draw_rect(inner, fill, true)
	draw_rect(rect, Color("d7b66f"), false, 1.0)
