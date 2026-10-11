extends Node2D

const ENEMY_SCENE := preload("res://scenes/actors/enemy.tscn")

const WALKABLE_AREA := Rect2(20, 190, 2160, 65)

var player: CharacterBody2D
var enemies: Array[CharacterBody2D] = []
var active_wave := 0
var encounter_locked := false
var street_lights := [Vector2(255, 187), Vector2(875, 187), Vector2(1520, 187)]

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
    var right_bound := WALKABLE_AREA.end.x - 14.0
    if encounter_locked:
        right_bound = minf(right_bound, 885.0)
    player.global_position.x = clampf(player.global_position.x, WALKABLE_AREA.position.x + 14.0, right_bound)
    player.global_position.y = clampf(player.global_position.y, WALKABLE_AREA.position.y + 10.0, WALKABLE_AREA.end.y)

func _update_encounter() -> void:
    if active_wave == 0 and player.global_position.x > 500:
        active_wave = 1
        encounter_locked = true
        _spawn_wave([Vector2(650, 213), Vector2(735, 239), Vector2(810, 220)])

    if encounter_locked and enemies.is_empty():
        encounter_locked = false
        queue_redraw()

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
    if distance < 0.01:
        offset = Vector2.RIGHT
        distance = 0.01
    if distance < minimum_distance:
        var correction := offset.normalized() * (minimum_distance - distance) * 0.5
        first.global_position -= correction
        second.global_position += correction

func _draw() -> void:
    # Sky and skyline
    draw_rect(Rect2(0, 0, 2200, 270), Color("0c0b18"), true)
    for x in range(0, 2200, 95):
        var height := 34.0 + float((x / 95) as int % 4) * 18.0
        draw_rect(Rect2(x, 92 - height, 88, height), Color("171727"), true)
        for wx in range(int(x + 12), int(x + 78), 17):
            draw_rect(Rect2(wx, 102 - height, 5, 8), Color("50465e"), true)

    # Back alley walls and skyline signs
    draw_rect(Rect2(0, 87, 2200, 29), Color("161523"), true)
    draw_rect(Rect2(0, 111, 2200, 81), Color("392e39"), true)
    draw_rect(Rect2(0, 115, 2200, 4), Color("15131f"), true)
    draw_rect(Rect2(0, 188, 2200, 4), Color("1a1722"), true)

    # Bricks across facades
    for row in range(0, 7):
        var y := 121.0 + row * 9.0
        var offset := 0 if row % 2 == 0 else 15
        for x in range(offset, 2200, 31):
            draw_rect(Rect2(x, y, 25, 5), Color("76434a"), true)
            draw_rect(Rect2(x + 1, y + 1, 23, 1), Color("a26257"), true)

    # Storefront body / trim
    draw_rect(Rect2(72, 128, 382, 66), Color("242235"), true)
    draw_rect(Rect2(76, 131, 374, 60), Color("4f3741"), false, 3.0)
    draw_rect(Rect2(95, 130, 329, 28), Color("c49440"), true)
    draw_rect(Rect2(99, 134, 321, 20), Color("2a2231"), true)
    draw_string(ThemeDB.fallback_font, Vector2(134, 150), "GREASE & GOLD", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("f9d87d"))
    draw_string(ThemeDB.fallback_font, Vector2(170, 156), "RECORDS", HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color("f4c75d"))

    # Record store display windows
    _draw_window(Rect2(105, 164, 115, 40))
    _draw_window(Rect2(228, 164, 115, 40))
    draw_rect(Rect2(351, 163, 54, 48), Color("191928"), true)
    draw_rect(Rect2(355, 168, 46, 39), Color("232438"), true)
    draw_rect(Rect2(365, 172, 25, 5), Color("f5cf6b"), true)
    draw_rect(Rect2(370, 185, 20, 1), Color("8a8ba5"), true)

    # Other building shutters
    for base_x in [495, 585, 670, 760, 1540, 1635, 1730, 1825]:
        draw_rect(Rect2(base_x, 130, 76, 59), Color("2a2939"), true)
        for stripe_y in range(136, 187, 5):
            draw_line(Vector2(base_x + 4, stripe_y), Vector2(base_x + 72, stripe_y), Color("5b5364"), 1.0)
        draw_rect(Rect2(base_x, 129, 76, 4), Color("161520"), true)

    # Sohbet billboard and posts
    draw_rect(Rect2(1025, 73, 210, 82), Color("1d1830"), true)
    draw_rect(Rect2(1029, 77, 202, 74), Color("543b94"), true)
    draw_rect(Rect2(1032, 80, 196, 68), Color("7957c1"), true)
    draw_circle(Vector2(1083, 107), 18, Color("e9dcff"))
    draw_circle(Vector2(1102, 107), 18, Color("d5c1ff"))
    draw_rect(Rect2(1080, 107, 25, 13), Color("7957c1"), true)
    draw_string(ThemeDB.fallback_font, Vector2(1130, 103), "SOHBET", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color("ffffff"))
    draw_string(ThemeDB.fallback_font, Vector2(1128, 123), "People. Conversation.", HORIZONTAL_ALIGNMENT_LEFT, -1, 7, Color("eee8ff"))
    draw_rect(Rect2(1060, 153, 7, 50), Color("262431"), true)
    draw_rect(Rect2(1191, 153, 7, 50), Color("262431"), true)

    # Sidewalk, curb and road
    draw_rect(Rect2(0, 192, 2200, 20), Color("a48d77"), true)
    draw_rect(Rect2(0, 212, 2200, 4), Color("d0b498"), true)
    draw_rect(Rect2(0, 216, 2200, 54), Color("303040"), true)
    draw_rect(Rect2(0, 218, 2200, 3), Color("171724"), true)
    for x in range(0, 2200, 54):
        draw_rect(Rect2(x + 2, 205, 49, 2), Color("77695f"), true)
        draw_rect(Rect2(x + 18, 249, 28, 2), Color("b98c5c"), true)
    for x in range(0, 2200, 77):
        draw_rect(Rect2(x + 9, 235 + (x % 3) * 3, 13, 1), Color("5c5866"), true)
        draw_rect(Rect2(x + 36, 260 - (x % 4) * 2, 8, 1), Color("1d1d2a"), true)

    # Street lamps with light pools
    for lamp in street_lights:
        draw_circle(lamp + Vector2(0, 26), 23, Color(0.98, 0.77, 0.30, 0.07))
        draw_rect(Rect2(lamp.x - 3, lamp.y - 70, 6, 73), Color("1c202b"), true)
        draw_rect(Rect2(lamp.x - 6, lamp.y - 74, 12, 8), Color("242936"), true)
        draw_circle(lamp + Vector2(0, -70), 5, Color("ffe17c"))
        draw_rect(Rect2(lamp.x - 8, lamp.y - 79, 16, 3), Color("151520"), true)

    # Street props
    _draw_trash_can(Vector2(472, 230))
    _draw_trash_can(Vector2(916, 232))
    _draw_trash_can(Vector2(1468, 232))
    _draw_crate(Vector2(695, 242))
    _draw_crate(Vector2(1590, 242))
    _draw_kebab(Vector2(560, 245))

func _draw_window(rect: Rect2) -> void:
    draw_rect(rect, Color("181b2b"), true)
    draw_rect(rect, Color("b1844f"), false, 2.0)
    draw_rect(Rect2(rect.position + Vector2(4, 4), Vector2(rect.size.x - 8, 7)), Color("f7cf68"), true)
    for x in range(int(rect.position.x + 12), int(rect.end.x - 12), 24):
        draw_circle(Vector2(x, rect.position.y + 25), 10, Color("12111f"))
        draw_circle(Vector2(x, rect.position.y + 25), 4, Color("d8ad4d"))
        draw_rect(Rect2(x - 10, rect.position.y + 36, 20, 2), Color("73524b"), true)

func _draw_trash_can(position: Vector2) -> void:
    draw_rect(Rect2(position.x, position.y - 25, 22, 25), Color("6f7777"), true)
    draw_rect(Rect2(position.x - 2, position.y - 28, 26, 5), Color("a9ae9e"), true)
    draw_rect(Rect2(position.x + 4, position.y - 22, 3, 18), Color("c7cbc1"), true)
    draw_rect(Rect2(position.x + 14, position.y - 22, 3, 18), Color("4d565d"), true)

func _draw_crate(position: Vector2) -> void:
    draw_rect(Rect2(position.x, position.y - 22, 27, 22), Color("9b6639"), true)
    draw_rect(Rect2(position.x + 2, position.y - 20, 23, 18), Color("c28b4c"), false, 2.0)
    draw_line(Vector2(position.x + 2, position.y - 20), Vector2(position.x + 25, position.y - 2), Color("73452c"), 2.0)
    draw_line(Vector2(position.x + 25, position.y - 20), Vector2(position.x + 2, position.y - 2), Color("73452c"), 2.0)

func _draw_kebab(position: Vector2) -> void:
    draw_rect(Rect2(position.x, position.y - 5, 17, 5), Color("d9aa61"), true)
    draw_rect(Rect2(position.x + 2, position.y - 4, 13, 2), Color("793c2f"), true)
    draw_rect(Rect2(position.x + 5, position.y - 6, 4, 2), Color("79a55b"), true)
