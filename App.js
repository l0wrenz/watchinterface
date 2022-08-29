import { StatusBar } from "expo-status-bar";
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
import base64 from "base-64";
import { BleManager } from "react-native-ble-plx";
import { LineChart, Grid } from "react-native-svg-charts";
import * as shape from "d3-shape";
import CheckBox from "@react-native-community/checkbox";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "./screens/settings_screen.js";
import Live from "./screens/live.js";

const Stack = createNativeStackNavigator();

const CONFIG = {
  BACKEND_IP: "localhost",
  BACKEND_PORT: "5000",
  PROTOCOL: "http",
  WATCH_BT_ID: "PLACEHOLDER",
};

const FLASK_BACKEND_URL = `${CONFIG.PROTOCOL}://${CONFIG.BACKEND_IP}:${CONFIG.BACKEND_PORT}`;

var Buffer = require("buffer/").Buffer;

class App extends Component {
  constructor() {
    super();
    this.manager = new BleManager();
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
    id: 0,
    easySettings: { number_of_planes: 5, plane_speed: 3, darkness: false },
    difficultSettings: { number_of_planes: 15, plane_speed: 5, darkness: true },
    timer: 180,
    img_src: FLASK_BACKEND_URL + "/get_image?v=",
    interval: null,
    game_state: "idle",
  };

  showData = (new_arr, timediff) => {
    if ((timediff <= 50000) & (timediff >= 500)) {
      this.setState({ showData: new_arr, data: [] });
      console.log(new_arr);
      let game_state = this.state.game_state;

      if (this.state.should_send_data) {
        this.postAPI({ new_arr, timediff, game_state });
      }
    }
  };

  switchWatchCon = () => {
    this.setState(
      { lastReceiveTime: Date.now(), active: !this.state.active },
      () => {
        if (this.state.active) {
          this.activateWatchConnection();
        } else {
          this.setState({ connected: false });
          this.manager.stopDeviceScan();
          if (this.state.deviceid !== "") {
            if (!this.state.firstTime) {
              this.setState({ firstTime: true });
            }
            clearInterval(this.state.interval);
            this.manager.cancelDeviceConnection(this.state.deviceid);
          }
        }
      }
    );
  };

  activateWatchConnection = () => {
    if (!this.state.active) {
      return;
    }
    console.log("Starting device scan");
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
        return;
      }
      this.setState({ deviceid: device.id }, () => {
        if (device.id == CONFIG.WATCH_BT_ID) {
          this.manager.stopDeviceScan();
          console.log("trying to connect");
          device
            .connect()
            .then((device) => {
              return device.discoverAllServicesAndCharacteristics();
            })
            .then((device) => {
              console.log("Got services and characteristics");
              this.setState({ connected: true });
              device
                .services()
                .then((services) => {
                  services.forEach(async (service) => {
                    if (service.uuid.includes("180d")) {
                      const characteristics =
                        await device.characteristicsForService(service.uuid);
                      const charuuid = characteristics[0].uuid;
                      console.log(charuuid);
                      device.monitorCharacteristicForService(
                        service.uuid,
                        charuuid,
                        async (error, characteristic) => {
                          if (error) {
                            console.log("error!");
                            console.log(error.message);
                            return;
                          }
                          if (!this.state.active) {
                            clearInterval(this.state.interval);
                            this.manager.stopDeviceScan();
                            this.manager.cancelDeviceConnection(
                              this.state.deviceid
                            );
                          }
                          const buf = Buffer.from(
                            characteristic.value,
                            "base64"
                          );
                          let arr = [];
                          for (let i = 0; i < buf.length; i++) {
                            arr[i] = buf[i];
                            if (arr[i] > 128) {
                              arr[i] = arr[i] - 256;
                            }
                          }
                          let receiveTime = Date.now();
                          let timediff =
                            receiveTime - this.state.lastReceiveTime;
                          let new_arr = this.state.data.concat(arr);
                          this.setState({
                            lastReceiveTime: receiveTime,
                            data: new_arr,
                          });
                          this.showData(new_arr, timediff);
                        }
                      );
                    }
                  });
                })
                .catch((error) => {
                  console.error(error);
                });
            })
            .catch((error) => {
              console.error(error);
            });
        }
      });
    });
  };

  postID = () => {
    fetch(FLASK_BACKEND_URL + "/switch_id", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: parseInt(this.state.id),
      }),
    });
  };

  setID = (id) => {
    this.setState({ id: id });
  };

  setDifficulty = () => {
    fetch(FLASK_BACKEND_URL + "/switch_difficulty", {
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
    return fetch(FLASK_BACKEND_URL + "/info").then((response) => {
      console.log(response);
    });
  };

  postAPI = (data_to_send) => {
    fetch(FLASK_BACKEND_URL + "/post_pulse_data", {
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
        img_src: FLASK_BACKEND_URL + "/get_image?v=" + Date.now() + "kk",
      });
    }, 500);
  };

  changeNOPlanes(text) {
    this.setState({ numberOfPlanes: text });
  }

  changePlaneSpeed(text) {
    this.setState({ planeSpeed: text });
  }

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
      // <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      //   <View style={styles.container}>
      //     {/* <LineChart
      //       style={{ height: 200, width: 350 }}
      //       data={this.state.showData}
      //       contentInset={{ top: 30, bottom: 30 }}
      //       svg={{ stroke: "rgb(222, 5, 5)" }}
      //       contentInset={{ top: 20, bottom: 20 }}
      //     >
      //       <Grid />
      //     </LineChart> */}
      //     <View style={{ height: 280, width: 500 }}>
      //       <Image
      //         style={{
      //           flex: 1,
      //           resizeMode: "contain",
      //           width: null,
      //           height: null,
      //         }}
      //         source={{
      //           uri: this.state.img_src,
      //         }}
      //       ></Image>
      //     </View>

      //     <TouchableOpacity style={styles.button} onPress={this.onPress}>
      //       <Text>Connect to the watch</Text>
      //     </TouchableOpacity>
      //     <Text>
      //       Status: {this.state.connected ? "Connected" : "Not connected"}
      //     </Text>

      //     <View
      //       style={{
      //         flexDirection: "row",
      //         alignItems: "center",
      //         marginTop: 10,
      //       }}
      //     >
      //       <Text style={styles.text}>ID: </Text>
      //       <TextInput
      //         style={styles.textInput}
      //         keyboardType="numeric"
      //         onChangeText={(text) => this.setID(text)}
      //         value={this.state.id}
      //         maxLength={3} //setting limit of input
      //       />
      //     </View>
      //     <View>
      //       <TouchableOpacity style={styles.button} onPress={this.postID}>
      //         <Text>Set ID</Text>
      //       </TouchableOpacity>
      //     </View>

      //     <View
      //       style={{
      //         flexDirection: "column",
      //         alignItems: "center",
      //         marginTop: 20,
      //       }}
      //     >
      //       <View
      //         style={{
      //           flexDirection: "row",
      //           alignItems: "center",
      //           marginTop: 10,
      //         }}
      //       >
      //         <Text style={styles.text}>Anzahl an Flugzeugen: </Text>
      //         <TextInput
      //           style={styles.textInput}
      //           keyboardType="numeric"
      //           onChangeText={(text) => this.changeNOPlanes(text)}
      //           value={this.state.numberOfPlanes}
      //           maxLength={3} //setting limit of input
      //         />
      //       </View>
      //       <View
      //         style={{
      //           flexDirection: "row",
      //           alignItems: "center",
      //           marginTop: 10,
      //         }}
      //       >
      //         <Text style={styles.text}>Flugzeuggeschwindigkeit: </Text>
      //         <TextInput
      //           style={styles.textInput}
      //           keyboardType="numeric"
      //           onChangeText={(text) => this.changePlaneSpeed(text)}
      //           value={this.state.planeSpeed}
      //           maxLength={3} //setting limit of input
      //         />
      //       </View>
      //       <View
      //         style={{
      //           flexDirection: "row",
      //           alignItems: "center",
      //           marginTop: 10,
      //         }}
      //       >
      //         <Text style={styles.text}>Dunkelheit: </Text>

      //         <CheckBox
      //           disabled={false}
      //           value={this.state.darkness}
      //           onValueChange={(newValue) =>
      //             this.setState({ darkness: newValue })
      //           }
      //         />
      //       </View>
      //       <TouchableOpacity
      //         style={styles.button}
      //         onPress={this.setDifficulty}
      //       >
      //         <Text>Set Difficulty</Text>
      //       </TouchableOpacity>
      //     </View>

      //     <TouchableOpacity
      //       style={styles.startButton}
      //       onPress={this.startTest.bind(this)}
      //     >
      //       <Text>Testlauf starten!</Text>
      //     </TouchableOpacity>
      //     <Text>Timer: {this.state.timer}</Text>
      //   </View>
      // </TouchableWithoutFeedback>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Settings"
            component={Settings}
            options={{ title: "Study Configurator" }}
          />
          <Stack.Screen name="Main" component={Live} />
        </Stack.Navigator>
      </NavigationContainer>
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

export default App;
