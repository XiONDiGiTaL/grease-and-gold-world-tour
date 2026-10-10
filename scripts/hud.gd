extends Control

@export var player_path: NodePath
@onready var player = get_node_or_null(player_path)

func _process(_delta: float) -> void:
    queue_redraw()

func _draw() -> void:
    if player == null:
        return
    var health_ratio: float = float(player.health) / float(player.max_health)
    var hype_ratio: float = player.hype / player.max_hype
    draw_rect(Rect2(12, 12, 205, 46), Color("141320"), true)
    draw_rect(Rect2(16, 16, 196, 16), Color("3b2834"), true)
    draw_rect(Rect2(18, 18, 192 * health_ratio, 12), Color("62d275"), true)
    draw_rect(Rect2(16, 38, 196, 12), Color("44385e"), true)
    draw_rect(Rect2(18, 40, 192 * hype_ratio, 8), Color("b77cf0"), true)
    draw_string(ThemeDB.fallback_font, Vector2(18, 11), "RICKY B", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("f5d787"))
