import React, { Component } from "react";

import {
  StyleSheet,
  Text,
  View,
  Button,
  TouchableOpacity,
  DatePickerAndroid,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { BleManager } from "react-native-ble-plx";

import CheckBox from "@react-native-community/checkbox";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

var Buffer = require("buffer/").Buffer;

class Live extends Component {
  constructor() {
    super();
    this.manager = new BleManager();
    GLOBAL.screen1 = this;
  }

  state = {
    active: false,
    deviceid: "",
    lastReceiveTime: Date.now(),
    cnt_data_received: 0,
    data: [],
    i: 0,
    firstTime: true,
    should_send_data: false,
    showData: [-1, -1, -1, -1, -1, -1, -1, -1],
    response: "",
    connected: false,
    numberOfPlanes: "0",
    planeSpeed: "0",
    darkness: false,
    easySettings: { number_of_planes: 5, plane_speed: 3, darkness: false },
    difficultSettings: { number_of_planes: 15, plane_speed: 5, darkness: true },
    timer: 180,
    img_src: "http://h2942775.stratoserver.net:5000/get_image?v=",
    interval1: null,
  };

  setID = (id) => {
    this.setState({ id: id });
  };

  setDifficulty = () => {
    fetch("http://h2942775.stratoserver.net:5000/switch_difficulty", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number_of_planes: parseInt(this.state.numberOfPlanes),
        plane_speed: parseInt(this.state.planeSpeed),
        darkness: this.state.darkness,
      }),
    });
  };

  requestAPI = () => {
    return fetch("http://h2942775.stratoserver.net:5000/info").then(
      (response) => {
        console.log(response);
      }
    );
  };

  postAPI = (data_to_send) => {
    fetch("http://h2942775.stratoserver.net:5000/post_pulse_data", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: data_to_send,
      }),
    });
    setTimeout(() => {
      this.setState({
        img_src:
          "http://h2942775.stratoserver.net:5000/get_image?v=" +
          Date.now() +
          "kk",
      });
    }, 500);
  };

  startTest() {
    // 1. Check if watch is connected
    if (this.state.connected) {
      this.setState({ timer: 180, should_send_data: true });
      let oneOrZero = Math.random() > 0.5 ? 1 : 0;
      let settings;
      let next_settings;
      if (oneOrZero === 1) {
        settings = this.state.difficultSettings;
        next_settings = this.state.easySettings;
      } else {
        settings = this.state.easySettings;
        next_settings = this.state.difficultSettings;
      }
      this.setState(
        {
          numberOfPlanes: settings["number_of_planes"],
          planeSpeed: settings["plane_speed"],
          darkness: settings["darkness"],
        },
        () => {
          this.setDifficulty();
          let interval = setInterval(() => {
            this.setState({ timer: this.state.timer - 1 });
          }, 1000);
          setTimeout(() => {
            clearInterval(interval);
            this.setState(
              {
                numberOfPlanes: next_settings["number_of_planes"],
                planeSpeed: next_settings["plane_speed"],
                darkness: next_settings["darkness"],
                timer: 180,
              },
              () => {
                this.setDifficulty();
                let interval1 = setInterval(() => {
                  this.setState({ timer: this.state.timer - 1 });
                  if (this.state.timer === 0) {
                    this.setState({ should_send_data: false });
                    clearInterval(interval1);
                  }
                }, 1000);
              }
            );
          }, 180000);
        }
      );
    }
    // 2. Random (hard/easy)
    // 3. 5 Min Timeout -> Switch Difficulty
    //
  }

  render() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View style={{ height: 280, width: 500 }}>
            <Image
              style={{
                flex: 1,
                resizeMode: "contain",
                width: null,
                height: null,
              }}
              source={{
                uri: this.state.img_src,
              }}
            ></Image>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              console.log(GLOBAL.screen1);
              clearInterval(GLOBAL.screen1.interval);
            }}
          >
            <Text>Connect to the watch</Text>
          </TouchableOpacity>
          <Text>
            Status: {this.state.connected ? "Connected" : "Not connected"}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <Text style={styles.text}>ID: </Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              onChangeText={(text) => this.setID(text)}
              value={this.state.id}
              maxLength={3} //setting limit of input
            />
          </View>
          <View>
            <TouchableOpacity style={styles.button} onPress={this.postID}>
              <Text>Set ID</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "column",
              alignItems: "center",
              marginTop: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <Text style={styles.text}>Anzahl an Flugzeugen: </Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                onChangeText={(text) => this.changeNOPlanes(text)}
                value={this.state.numberOfPlanes}
                maxLength={3} //setting limit of input
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <Text style={styles.text}>Flugzeuggeschwindigkeit: </Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                onChangeText={(text) => this.changePlaneSpeed(text)}
                value={this.state.planeSpeed}
                maxLength={3} //setting limit of input
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <Text style={styles.text}>Dunkelheit: </Text>

              <CheckBox
                disabled={false}
                value={this.state.darkness}
                onValueChange={(newValue) =>
                  this.setState({ darkness: newValue })
                }
              />
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={this.setDifficulty}
            >
              <Text>Set Difficulty</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={this.startTest.bind(this)}
          >
            <Text>Testlauf starten!</Text>
          </TouchableOpacity>
          <Text>Timer: {this.state.timer}</Text>
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#DDDDDD",
    padding: 10,
    marginBottom: 10,
    height: 40,
    width: 200,
  },
  textInput: {
    height: 40,
    width: 50,
    fontSize: 18,
    borderColor: "black",
    borderWidth: 2,
  },
  text: {
    fontSize: 18,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "orange",
    padding: 10,
    marginBottom: 10,
    height: 40,
    width: 200,
  },
});

export default Live;
