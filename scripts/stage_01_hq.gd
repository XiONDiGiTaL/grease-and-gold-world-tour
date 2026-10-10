extends Node2D

const ENEMY_SCENE := preload("res://scenes/actors/enemy.tscn")

const WALKABLE_AREA := Rect2(20, 178, 2160, 80)
const SOLIDS := [
    Rect2(0, 112, 2200, 62),
    Rect2(282, 196, 22, 54),
    Rect2(430, 214, 30, 30),
    Rect2(680, 223, 40, 27),
    Rect2(1125, 214, 30, 30),
    Rect2(1540, 221, 40, 29)
]

var player: CharacterBody2D
var enemies: Array[CharacterBody2D] = []
var active_wave := 0
var encounter_locked := false

func _ready() -> void:
    queue_redraw()

func set_player(value: CharacterBody2D) -> void:
    player = value

func _physics_process(_delta: float) -> void:
    if player == null:
        return
    _constrain_player()
    _resolve_enemy_separation()
    _update_encounter()

func _constrain_player() -> void:
    player.global_position.x = clampf(player.global_position.x, WALKABLE_AREA.position.x + 14.0, WALKABLE_AREA.end.x - 14.0)
    player.global_position.y = clampf(player.global_position.y, WALKABLE_AREA.position.y + 14.0, WALKABLE_AREA.end.y)

func _update_encounter() -> void:
    if active_wave == 0 and player.global_position.x > 520:
        active_wave = 1
        encounter_locked = true
        _spawn_wave([Vector2(660, 212), Vector2(730, 237), Vector2(805, 220)])

    if encounter_locked and enemies.is_empty():
        encounter_locked = false

func _spawn_wave(spawns: Array[Vector2]) -> void:
    for spawn_position in spawns:
        var enemy: CharacterBody2D = ENEMY_SCENE.instantiate()
        enemy.position = spawn_position
        add_child(enemy)
        enemy.set_target(player)
        enemies.append(enemy)
        enemy.tree_exited.connect(func() -> void: enemies.erase(enemy))

func _resolve_enemy_separation() -> void:
    for enemy in enemies:
        if is_instance_valid(enemy):
            _separate_bodies(player, enemy)

    for first_index in enemies.size():
        for second_index in range(first_index + 1, enemies.size()):
            var first := enemies[first_index]
            var second := enemies[second_index]
            if is_instance_valid(first) and is_instance_valid(second):
                _separate_bodies(first, second)

func _separate_bodies(first: CharacterBody2D, second: CharacterBody2D) -> void:
    var offset := second.global_position - first.global_position
    var distance := offset.length()
    var minimum_distance := 25.0
    if distance == 0.0:
        offset = Vector2.RIGHT
        distance = 0.01
    if distance < minimum_distance:
        var correction := offset.normalized() * (minimum_distance - distance) * 0.5
        first.global_position -= correction
        second.global_position += correction

func _draw() -> void:
    draw_rect(Rect2(0, 0, 2200, 270), Color("10111d"), true)
    draw_rect(Rect2(0, 112, 2200, 62), Color("362c3a"), true)
    draw_rect(Rect2(0, 174, 2200, 28), Color("8f7c6b"), true)
    draw_rect(Rect2(0, 202, 2200, 68), Color("454353"), true)

    for x in range(0, 2200, 36):
        draw_line(Vector2(x, 120), Vector2(x + 24, 120), Color("915b45"), 2.0)
        draw_line(Vector2(x + 10, 142), Vector2(x + 32, 142), Color("915b45"), 2.0)

    draw_rect(Rect2(80, 126, 310, 34), Color("c69a4e"), true)
    draw_string(ThemeDB.fallback_font, Vector2(101, 149), "GREASE & GOLD RECORDS", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("211a2d"))

    for solid in SOLIDS.slice(1):
        draw_rect(solid, Color("75665e"), true)
        draw_rect(solid, Color("24232d"), false, 2.0)

    draw_rect(Rect2(1340, 120, 160, 56), Color("5f3f94"), true)
    draw_string(ThemeDB.fallback_font, Vector2(1370, 148), "SOHBET", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)
    draw_string(ThemeDB.fallback_font, Vector2(1354, 163), "People. Conversation.", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("e8dbff"))
