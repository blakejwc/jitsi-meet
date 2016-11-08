/* global $, APP, interfaceConfig, config*/

import Ros from "../util/Ros";
import UIEvents from "../../../service/UI/UIEvents";
import UIUtil from "../util/UIUtil";

const thumbAspectRatio = 1 / 1;

/**
 * A widget-specific enumeration of joystick states
 * @property modeEnum {ENUM.MODE}
 */
const modeEnum = {
    NONE: 0,
    REGULAR: 1,
    SUPER: 2
};

const mouseEnum = {
	LEFT: 0,
	MIDDLE: 1,
	RIGHT: 2
};

/**
 * The meters / second maximum linear speed
 * @property MAX_VELOCITY {Float}
 */
const MAX_VELOCITY = 0.2;

/**
 * The max time (in milliseconds) allowed for continuous super teleoperation
 * @private
 * @property MAX_SUPER_TIME {Integer}
 */
const MAX_SUPER_TIME = 7000;

/**
 * The minimum number of milliseconds in between joystick velocity commands
 * @private
 * @property VELOCITY_COMMAND_PING {Integer}
 */
const VELOCITY_COMMAND_PING = 100;

/**
 * The minimum number of milliseconds in between camera tilt commands
 * @private
 * @property CAMERA_TILT_COMMAND_PING {Integer}
 */
const CAMERA_TILT_COMMAND_PING = 100;

/**
 * The radians / second maximum angular speed
 * @property MAX_OMEGA {Float}
 */
const MAX_OMEGA = 0.2;

const Joystick = {
    /**
     *
     * @param eventEmitter the {EventEmitter} through which {Joystick} is to
     * emit/fire {UIEvents} (such as {UIEvents.TOGGLED_JOYSTICK}).
     * @method init
     */
    init (eventEmitter) {
        this.joystickContainer = $('#driveControlsContainer');
        this.joystickCanvas = $('#joystickCanvas');
        this.eventEmitter = eventEmitter;
        this.toggleJoystick(false);
        this.WIDTH = 1;
        this.HEIGHT = 1;
        this.setControls(0, 0);
        this._mode = modeEnum.NONE;
        this._ctx = this.joystickCanvas[0].getContext('2d');
        // Set up the render and drive control transmit intervals.
        window.setInterval($.proxy(this.renderJoystick, this), 10);
        this._transmitInterval = window.setInterval(
            $.proxy(this.transmit, this), VELOCITY_COMMAND_PING);
        this._cameraTiltInterval = null;
        // Set up event listeners.
        this.joystickCanvas.on('mousedown', $.proxy(this.mouseDownEvent, this));
        $(window).on('contextmenu', $.proxy(this.contextEvent, this));
        $(window).on('mouseup', $.proxy(this.mouseUpEvent, this));
        $(window).on('mousemove', $.proxy(this.mouseMoveEvent, this));
        $('#camera_tilt_up').on('mousedown', $.proxy(this.tiltCameraUp, this));
        $('#camera_tilt_down').on('mousedown',
            $.proxy(this.tiltCameraDown, this));
    },

    /**
     * Toggles the visibility of the joystick.
     *
     * @param visible optional {Boolean} which specifies the desired visibility
     * of the joystick. If not specified, the visibility will be flipped
     * (i.e. toggled); otherwise, the visibility will be set to the specified
     * value.
     * @method toggleJoystick
     */
    toggleJoystick (visible) {
        if (typeof visible === 'boolean'
                && this.isJoystickVisible() == visible) {
            return;
        }

        this.joystickContainer.toggleClass("hidden");

        // Emit/fire UIEvents.TOGGLED_JOYSTICK.
        var eventEmitter = this.eventEmitter;
        if (eventEmitter) {
            eventEmitter.emit(
                    UIEvents.TOGGLED_JOYSTICK,
                    this.isJoystickVisible());
        }
    },

    /**
     * Determines whether the robot drive control panel is visible.
     * @return true if the joystick container is visible, false otherwise.
     * @method isJoystickVisible
     */
    isJoystickVisible () {
        return !this.joystickContainer.hasClass('hidden');
    },

    /**
     * Renders the joystick on the canvas.
     * @method renderJoystick
     */
    renderJoystick() {
        var blink,
        ctx = this._ctx;
        if (ctx && this.isJoystickVisible()) {
            ctx.clearRect(0, 0, 300,300);
            // grid lines
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = 'rgba(100, 100, 100, 1)';
            ctx.beginPath();
            ctx.moveTo(0, parseInt(this.HEIGHT/2.0));
            ctx.lineTo(this.WIDTH, parseInt(this.HEIGHT/2.0));
            ctx.moveTo(parseInt(this.WIDTH/2.0), 0);
            ctx.lineTo(parseInt(this.WIDTH/2.0), this.HEIGHT);
            ctx.stroke();
            // joystick connector
            ctx.strokeStyle = 'rgba(100, 100, 100, 1)';
            ctx.beginPath();
            ctx.moveTo(parseInt(this.WIDTH/2.0), parseInt(this.HEIGHT/2.0));
            ctx.lineTo(this._joystick.x, this._joystick.y);
            ctx.stroke();
            // joystick knob;
            blink = Math.sin(+new Date()/700.0) * 0.25 + 0.6;
            if (this._mode === modeEnum.NONE) {
                ctx.fillStyle = 'rgba(100, 100, 100, ' + blink + ')';
            } else if (this._mode === modeEnum.REGULAR) {
                ctx.fillStyle = 'rgba(100, 255, 100, ' + blink + ')';
            } else if (this._mode === modeEnum.SUPER) {
                ctx.fillStyle = 'rgba(255, 100, 100, ' + (blink + 0.3) + ')';
            }
            ctx.fillRect(this._joystick.x - 5, this._joystick.y - 5, 10, 10);
        }
    },

    /**
     * Transmit the current velocity if the mouse is being dragged
     * @method transmit
     */
    transmit: function() {
        var vel, alpha, robot, newWidth, newHeight;

        if (this._mode !== modeEnum.NONE) {
            vel = this._controls.y * MAX_VELOCITY;
            alpha = this._controls.x * MAX_OMEGA;
            // TODO: Remove console.log once UV4L-Jitsi datachannels are working
            console.log(vel, alpha, (this._mode === modeEnum.REGULAR) ? 0 : 1);
            Ros.drive(vel, alpha, (this._mode === modeEnum.REGULAR) ? 0 : 1);
        } else {
            this.setControls(0, 0);
        }

        // Also verifies that the joystick panel size is correct.
        newWidth = this.joystickCanvas.width();
        newHeight = this.joystickCanvas.height();
        if (this.WIDTH !== newWidth || this.HEIGHT !== newHeight) {
            this.WIDTH = newWidth;
            this.HEIGHT = newHeight;
            this.joystickCanvas.attr('width', parseInt(this.WIDTH));
            this.joystickCanvas.attr('height', parseInt(this.HEIGHT));
        }
    },

    /**
     * Set the control state
     *
     * @method setControls
     * @param x {Float} the normalized joystick x coordinate
     * @param y {Float} the normalized joystick y coordinate
     */
    setControls(x, y) {
        this._joystick = {
            x: x + this.WIDTH/2.0,
            y: y + this.HEIGHT/2.0,
        };
        this._controls = {
            'x': -(x / (this.WIDTH/2.0)),
            'y': -(y / (this.WIDTH/2.0))
        };
    },

    /**
     * Sets the joystick operating mode and handles relevant UI updates
     *
     * @method setMode
     * @param mode {ENUM.MODE}
     */
    setMode: function(mode) {
        if (APP.conference.isDominantSpeaker) {
            this._mode = mode;
            switch (mode) {
                case modeEnum.SUPER:
                    this.joystickCanvas.addClass('active');
                    break;
                case modeEnum.REGULAR:
                    this.joystickCanvas.addClass('active');
                    break;
                default:
                    this.joystickCanvas.removeClass('active');
            }
        }
        else {
            this._mode = modeEnum.NONE;
        }
    },

    /**
     * Mouse down event responsible for enabling different joystick modes
     *
     * @method mouseDownEvent
     * @param evt {MouseEvent}
     */
    mouseDownEvent(evt) {
        if (this._mode !== modeEnum.NONE) {
            this.mouseUpEvent(evt);
        } else {
            if (evt.button === mouseEnum.LEFT) {
                this.setMode(modeEnum.REGULAR);
            } else if (evt.button === mouseEnum.RIGHT) {
                this.setMode(modeEnum.SUPER);
                this._stopSuperTimeout = window.setTimeout($.proxy(function() {
                    this.setMode(modeEnum.REGULAR);
                }, this), MAX_SUPER_TIME);
            }
        }
        this.mouseMoveEvent(evt);
    },

    /**
     * Mouse up event responsible for resetting the joystick mode and controls
     * to default
     *
     * @method mouseUpEvent
     * @param evt {MouseEvent}
     */
    mouseUpEvent() {
        this.setMode(modeEnum.NONE);
        this.setControls(0, 0);

        if (this._stopSuperTimeout) {
            window.clearTimeout(this._stopSuperTimeout);
        }
        if (this._cameraTiltInterval) {
            window.clearInterval(this._cameraTiltInterval);
        }
    },

    /**
     * Mouse move event responsible for setting the joystick control state
     *
     * @method mouseMoveEvent
     * @param evt {MouseEvent}
     */
    mouseMoveEvent(evt) {
        if (this._mode !== modeEnum.NONE) {
            evt.preventDefault();

            // Determine the screen-coordinate of the mouse
            let frameOffset = $(evt.target).offset();
            let offset = this.joystickCanvas.offset();
            let posX = evt.offsetX + (-offset.left + frameOffset.left);
            let posY = evt.offsetY + (-offset.top + frameOffset.top);
            // Limit the joystick bounds
            if (posX < 10) {
                posX = 10;
            } else if (posX > this.WIDTH - 10) {
                posX = this.WIDTH - 10;
            }
            if (posY < 10) {
                posY = 10;
            } else if (posY > this.HEIGHT - 10) {
                posY = this.HEIGHT - 10;
            }
            this.setControls(posX - this.WIDTH/2.0, posY - this.HEIGHT/2.0);

            return false;
        }
    },

    /**
     * Prevent default context if hovering on this.joystickCanvas
     *
     * @method contextEvent
     * @param evt {MouseEvent}
     */
    contextEvent(evt) {
        if (evt.target === this.joystickCanvas[0]) {
            return false;
        }
    },

    /**
     * Callback function for the camera tilt up button.
     * Starts tilting the camera upward at a fixed rate until
     * the button is released.
     * @method tiltCameraUp
     */
    tiltCameraUp() {
        if (APP.conference.isDominantSpeaker) {
            this.tiltCamera(1);
        }
    },

    /**
     * Callback function for the camera tilt down button.
     * Starts tilting the camera downward at a fixed rate until
     * the button is released.
     * @method tiltCameraDown
     */
    tiltCameraDown() {
        if (APP.conference.isDominantSpeaker) {
            this.tiltCamera(-1);
        }
    },

    /**
     * Repeatedly sends commands to tilt the camera by the specified
     * amount every CAMERA_TILT_COMMAND_PING milliseconds.
     * To stop the tilt commands, call
     * "window.clearInterval(this._cameraTiltInterval);"
     * @param amount {Number} the amound to tilt the camera at each step.
     * @method tiltCamera
     */
    tiltCamera(amount) {
        this._cameraTiltInterval = window.setInterval($.proxy(function() {
            // TODO: Remove console.log once UV4L-Jitsi datachannels are working
            console.log('Tilting camera = ' + amount);
            Ros.publishROSMessage('/camera_tilt', 'std_msgs/Int16', {
                data: amount
            });
        }, this), CAMERA_TILT_COMMAND_PING);
    }
};

export default Joystick;
