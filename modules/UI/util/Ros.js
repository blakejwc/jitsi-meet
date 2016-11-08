/* global $, APP, interfaceConfig, config*/

/**
 * A collection of functions for communicating with Rosbridge
 * over the WebRTC datachannels.
 */
const Ros = {

    /**
     * Should be called on startup
     * @method init
     */
    init() {
        // Tracks the topic names that have been advertised by this application.
        this._advertisedTopics = [];
    },

    /****************************************************
     * General functions for interacting with ROS topics
     ****************************************************/

    /**
     * Advertise the specified ROS topic for publishing.
     * @param topic {String} the name of the topic
     * (including the initial slash)
     * @param type {String} the message type to publish on thistopic.
     * @return {Boolean} true if the topic was successfully advertised,
     *   false otherwise.
     * @method advertiseROSTopic
     */
    advertiseROSTopic(topic, type) {
        var advertiseObj = {
            "op": "advertise",
            "topic": topic,
            "type": type
        };
        return this.sendDatachannelMessage(JSON.stringify(advertiseObj));
    },

    /**
     * Publish the specified ROS message on the given topic. If the topic
     * has not yet been advertised, calls advertiseROSTopic first.
     * @param topic {String} the name of the topic (including the initial slash)
     * @param type {String} the type of the message to publish.
     * @param messageObj {Object} the JSON object to publish
     * @return {Boolean} true if the message was published successfully,
     *   false otherwise.
     * @method publishROSMessage
     */
    publishROSMessage(topic, type, messageObj) {
        var publishObj = {
            "op": "publish",
            "topic": topic,
            "msg": messageObj
        };
        // Advertise the topic if it has not yet been advertised.
        if (this._advertisedTopics.indexOf(topic) == -1) {
            if (this.advertiseROSTopic(topic, type)) {
                this._advertisedTopics.push(topic);
            } else {
                return false;
            }
        }
        
        return this.sendDatachannelMessage(JSON.stringify(publishObj));
    },

    /**
     * Broadcases a message over the WebRTC datachannels with the
     * specified text.
     * @param messageText {String} the text of the message to publish
     * @return {Boolean} true if the message was sent successfully,
     *   false otherwise. The most common cause of failure is the
     *   datachannels not being set up because only one client is in
     *   the call. Thus, when this method returns false, the caller may
     *   want to try to call it again later, once all clients have
     *   joined the call.
     * @method sendDatachannelMessage
     */
    sendDatachannelMessage(messageText) {
        try {
            APP.conference._room.rtc.sendDataChannelMessage('',
                {
                    'msg': messageText
                }
            );
            return true;
        } catch(err) {
            console.log('Failed to send message.'
             + 'This could be because no datachannels are set up yet.');
            return false;
        }
    },


    /***************************************************
     * More specific functions for robot control
     ***************************************************/

    /**
     * Publish a geometry_msgs/Twist message to issue a drive command
     *
     * @param vel    {Float} The linear velocity (meters / sec)
     * @param alpha  {Float} The angular turn rate (radians / sec)
     * @param mode   {Integer} Value 0 for regular drive, Value 1 for override
     * @method drive
     */
    drive: function(vel, alpha, mode) {
        var message = {
            linear: {
                x: vel,
                y: mode,
                z: 0
            },
            angular: {
                x: 0,
                y: 0,
                z: alpha
            }
        };
        this.publishROSMessage('/teleop_cmd_vel', 
                               'geometry_msgs/Twist',
                               message);
    },

};

export default Ros;