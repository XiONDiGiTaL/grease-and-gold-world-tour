extends CharacterBody2D

signal attack_started(facing: int)
signal special_started(facing: int)
signal hype_changed(value: float)

@export var walk_speed := 145.0
@export var depth_speed_multiplier := 0.72
@export var max_health := 110
@export var max_hype := 100.0

var health := max_health
var hype := 0.0
var facing := 1
var state := "idle"
var knockback := Vector2.ZERO
var attack_timer := 0.0
var special_timer := 0.0
var invulnerability_timer := 0.0

@onready var direction_marker: Polygon2D = $DirectionMarker

func _physics_process(delta: float) -> void:
    invulnerability_timer = maxf(invulnerability_timer - delta, 0.0)
    attack_timer = maxf(attack_timer - delta, 0.0)
    special_timer = maxf(special_timer - delta, 0.0)

    if state == "dead":
        return

    if attack_timer > 0.0 or special_timer > 0.0:
        velocity = knockback
        knockback = knockback.move_toward(Vector2.ZERO, 900.0 * delta)
        move_and_slide()
        return

    var input_vector := Input.get_vector("move_left", "move_right", "move_up", "move_down")
    velocity = Vector2(input_vector.x * walk_speed, input_vector.y * walk_speed * depth_speed_multiplier)

    if input_vector.x != 0.0:
        facing = 1 if input_vector.x > 0.0 else -1
        direction_marker.scale.x = facing

    if Input.is_action_just_pressed("attack"):
        start_attack()
    elif Input.is_action_just_pressed("special") and hype >= max_hype:
        start_special()
    elif Input.is_action_just_pressed("jump"):
        state = "jump"
    else:
        state = "walk" if input_vector.length() > 0.0 else "idle"

    move_and_slide()

func start_attack() -> void:
    state = "attack"
    attack_timer = 0.28
    emit_signal("attack_started", facing)

func start_special() -> void:
    state = "special"
    special_timer = 0.68
    hype = 0.0
    emit_signal("hype_changed", hype)
    emit_signal("special_started", facing)

func apply_hit(damage: int, push: Vector2) -> void:
    if invulnerability_timer > 0.0:
        return
    health = max(health - damage, 0)
    knockback = push
    invulnerability_timer = 0.25
    if health <= 0:
        state = "dead"

func add_hype(amount: float) -> void:
    hype = clampf(hype + amount, 0.0, max_hype)
    emit_signal("hype_changed", hype)
