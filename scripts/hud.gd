extends Control
## HUD: health/HYPE bars, score, lives. Portrait uses the real Ricky sprite.

var player: CharacterBody2D
var stage: Node2D
var score := 0
var lives := 3
var health_ratio := 1.0
var hype_ratio := 0.0

var portrait_tex: Texture2D

func _ready() -> void:
	portrait_tex = load("res://art/characters/ricky/frame_00.png") as Texture2D

func set_player(p: CharacterBody2D) -> void:
	player = p

func set_stage(s: Node2D) -> void:
	stage = s

func on_health_changed(value: int, maximum: int) -> void:
	health_ratio = clampf(float(value) / float(maxi(maximum, 1)), 0.0, 1.0)
	queue_redraw()

func on_hype_changed(value: float, maximum: float) -> void:
	hype_ratio = clampf(value / maxf(maximum, 1.0), 0.0, 1.0)
	queue_redraw()

func set_score(s: int) -> void:
	score = s
	queue_redraw()

func _draw() -> void:
	# Portrait frame with real Ricky sprite
	draw_rect(Rect2(8, 8, 56, 56), Color(0.09, 0.08, 0.13), true)
	if portrait_tex:
		# Head/shoulders region of the idle sprite, cropped to the frame
		draw_texture_rect_region(portrait_tex, Rect2(10, 10, 52, 52), Rect2(140, 20, 120, 120))
	draw_rect(Rect2(8, 8, 56, 56), Color(0.91, 0.72, 0.34), false, 2.0)

	# Name + bars
	draw_string(ThemeDB.fallback_font, Vector2(72, 22), "RICKY B",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.97, 0.83, 0.48))
	_bar(Rect2(72, 30, 200, 12), health_ratio, Color(0.32, 0.81, 0.45), Color(0.24, 0.16, 0.21))
	_bar(Rect2(72, 46, 200, 8), hype_ratio, Color(0.68, 0.40, 0.93), Color(0.24, 0.20, 0.36))

	# Score / lives
	draw_string(ThemeDB.fallback_font, Vector2(300, 22), "SCORE %06d" % score,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.94, 0.78, 0.34))
	draw_string(ThemeDB.fallback_font, Vector2(300, 40), "LIVES x%d" % lives,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)

func _bar(rect: Rect2, ratio: float, fill: Color, back: Color) -> void:
	draw_rect(rect, Color(0.04, 0.03, 0.07), true)
	var inner := Rect2(
		rect.position + Vector2(1, 1),
		Vector2((rect.size.x - 2) * ratio, rect.size.y - 2)
	)
	if inner.size.x > 0.0:
		draw_rect(inner, fill, true)
	draw_rect(Rect2(rect.position + Vector2(1, 1), rect.size - Vector2(2, 2)), back, false, 1.0)
	draw_rect(rect, Color(0.84, 0.71, 0.44), false, 1.0)
