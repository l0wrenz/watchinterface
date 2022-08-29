import { stderr } from "chalk";
import React, { Component } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Button,
} from "react-native";
import { LineChart, Grid } from "react-native-svg-charts";
import { BleManager } from "react-native-ble-plx";

var Buffer = require("buffer/").Buffer;

const CONFIG = {
  BACKEND_IP: "localhost",
  BACKEND_PORT: "5000",
  PROTOCOL: "http",
  WATCH_BT_ID: "PLACEHOLDER",
};

const FLASK_BACKEND_URL = `${CONFIG.PROTOCOL}://${CONFIG.BACKEND_IP}:${CONFIG.BACKEND_PORT}`;

class Settings extends Component {
  constructor() {
    super();
    this.manager = new BleManager();
  }

  componentDidMount() {
    this.setDifficulty({
      numberOfPlanes: 0,
      planeSpeed: 0,
      darkness: false,
    });
  }

  state = {
    id: "0",
    live: false,
    easySettings: {
      numberOfPlanes: 5,
      planeSpeed: 3,
      darkness: false,
      timer: 300,
      paused: false,
      info_text: "Einfach",
    },
    hardSettings: {
      numberOfPlanes: 15,
      planeSpeed: 5,
      darkness: true,
      timer: 300,
      paused: false,
      info_text: "Schwierig",
    },
    idleSettings: {
      numberOfPlanes: 0,
      planeSpeed: 0,
      darkness: false,
      timer: 300,
      paused: true,
      info_text: "Ruhepuls messen",
    },
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
    current_timer: 5,
    img_src: FLASK_BACKEND_URL + "/get_image?v=",
    pulse_state: "",
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

  showData = (new_arr, timediff) => {
    if (new_arr.length >= 250) {
      this.setState({ showData: new_arr, data: [] });
      let pulse_state = this.state.pulse_state;
      if (this.state.should_send_data) {
        this.postAPI({ new_arr, timediff, state: pulse_state });
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
                          console.log(arr);
                          let receiveTime = Date.now();
                          let timediff =
                            receiveTime - this.state.lastReceiveTime;
                          let new_arr = [...this.state.data];
                          new_arr.push(arr[0]);
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
  changeNOPlanes_easy(text) {
    this.setState((prevState) => {
      let easySettings = Object.assign({}, prevState.easySettings);
      easySettings.numberOfPlanes = text;
      return { easySettings };
    });
  }
  changeTimer_easy(text) {
    this.setState((prevState) => {
      let easySettings = Object.assign({}, prevState.easySettings);
      easySettings.timer = text;
      return { easySettings };
    });
  }
  changePlaneSpeed_easy(text) {
    this.setState((prevState) => {
      let easySettings = Object.assign({}, prevState.easySettings);
      easySettings.planeSpeed = text;
      return { easySettings };
    });
  }
  changeNOPlanes_hard(text) {
    this.setState((prevState) => {
      let hardSettings = Object.assign({}, prevState.hardSettings);
      hardSettings.numberOfPlanes = text;
      return { hardSettings };
    });
  }
  changePlaneSpeed_hard(text) {
    this.setState((prevState) => {
      let hardSettings = Object.assign({}, prevState.hardSettings);
      hardSettings.planeSpeed = text;
      return { hardSettings };
    });
  }
  changeTimer_hard(text) {
    this.setState((prevState) => {
      let hardSettings = Object.assign({}, prevState.hardSettings);
      hardSettings.timer = text;
      return { hardSettings };
    });
  }

  setDifficulty = (settings) => {
    console.log(settings);
    fetch(FLASK_BACKEND_URL + "/switch_difficulty", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number_of_planes: parseInt(settings["numberOfPlanes"]),
        plane_speed: parseInt(settings["planeSpeed"]),
        darkness: settings["darkness"],
        paused: settings["paused"],
        info_text: settings["info_text"],
      }),
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

  setID(id) {
    this.setState({ id: id });
  }

  startSecond = () => {
    let settings = this.state.secondSettings;
    console.log("Starting second");
    this.setState(
      {
        current_timer: parseInt(settings["timer"]),
        stateText: settings.darkness ? "Schwierig" : "Einfach",
        runTwo: false,
        pulse_state: settings.darkness ? "hard" : "easy",
      },

      () => {
        this.setDifficulty(settings);

        let thirdTimer = setInterval(() => {
          this.setState({ current_timer: this.state.current_timer - 1 });
        }, 1000);

        this.setState({ thirdTimer: thirdTimer });
        setTimeout(() => {
          clearInterval(thirdTimer);
          this.setState({
            live: false,
            should_send_data: false,
            awaitStart: false,
          });
          this.setDifficulty({
            numberOfPlanes: 0,
            planeSpeed: 0,
            darkness: false,
            paused: true,
            info_text: "Bitte Fragebogen ausfüllen",
          });
        }, parseInt(settings["timer"] * 1000));
      }
    );
  };

  startFirst = () => {
    let oneOrZero = Math.random() > 0.5 ? 1 : 0;
    let settings;
    let next_settings;
    if (oneOrZero === 1) {
      settings = this.state.hardSettings;
      next_settings = this.state.easySettings;
    } else {
      settings = this.state.easySettings;
      next_settings = this.state.hardSettings;
    }

    this.setState(
      {
        current_timer: parseInt(settings["timer"]),
        stateText: settings.darkness ? "Schwierig" : "Einfach",
        secondSettings: next_settings,
        awaitStart: false,
        pulse_state: settings.darkness ? "hard" : "easy",
      },
      () => {
        this.setDifficulty(settings);

        let secondTimer = setInterval(() => {
          this.setState({
            current_timer: this.state.current_timer - 1,
            secondTimer: secondTimer,
          });
        }, 1000);
        this.setState({
          secondTimer: secondTimer,
        });

        setTimeout(() => {
          clearInterval(secondTimer);
          this.setState({
            runTwo: true,
            stateText: "Halbzeit",
            current_timer: "-",
            pulse_state: "between",
          });
          this.setDifficulty({
            numberOfPlanes: 0,
            planeSpeed: 0,
            darkness: false,
            paused: true,
            info_text: "Bitte Atemübungen machen",
          });
        }, parseInt(settings["timer"] * 1000));
      }
    );
  };

  start = () => {
    this.setState(
      {
        should_send_data: true,
        live: true,
        current_timer: "-",
        stateText: "Ruhepuls",
        pulse_state: "resting",
      },
      () => {
        this.setDifficulty({
          numberOfPlanes: 0,
          planeSpeed: 0,
          darkness: false,
          paused: true,
        });

        this.setState({ awaitStart: true });
      }
    );
  };

  render() {
    const { navigation } = this.props;

    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        {!this.state.live ? (
          <View style={styles.container}>
            <View style={styles.infoField1}>
              <View style={styles.statusLine}>
                <Text style={styles.statusText}>
                  Watchstatus:{" "}
                  {this.state.connected ? "Connected" : "Not connected"}
                </Text>

                <TouchableOpacity
                  style={
                    this.state.connected
                      ? styles.disconnectWatch
                      : styles.connectWatch
                  }
                  onPress={this.switchWatchCon}
                >
                  <Text style={styles.startButtonText}>
                    {this.state.connected ? "Disconnect" : "Connect"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.statusLine}>
                <Text style={styles.statusText}>Current ID:</Text>
                <TouchableOpacity style={styles.changeID} onPress={this.postID}>
                  <Text style={styles.startButtonText}>Wechseln</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  onChangeText={(text) => this.setID(text)}
                  value={this.state.id.toString()}
                  defaultValue={this.state.id.toString()}
                  maxLength={3} //setting limit of input
                />
              </View>
            </View>
            <View style={styles.infoFieldContainer}>
              <View style={styles.infoField2}>
                <View
                  style={{
                    flex: 2,
                    justifyContent: "center",
                    alignItems: "center",
                    bottom: 5,
                  }}
                >
                  <Text style={styles.settingsLineText}>Settings</Text>
                  <Text
                    style={{
                      ...styles.statusText,
                      margin: 5,
                      marginTop: 15,
                    }}
                  >
                    Flugzeuganzahl:
                  </Text>
                  <Text
                    style={{
                      ...styles.statusText,
                      marginTop: 15,
                      left: 3,
                    }}
                  >
                    Geschwindigkeit:
                  </Text>
                  <Text
                    style={{
                      ...styles.statusText,
                      marginTop: 15,
                      right: 21,
                    }}
                  >
                    Zeitdauer:
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View style={styles.easySign}>
                    <Text style={styles.settingsHead}>Einfach</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changeNOPlanes_easy(text)}
                    value={this.state.easySettings["numberOfPlanes"].toString()}
                    maxLength={3} //setting limit of input
                  />
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changePlaneSpeed_easy(text)}
                    value={this.state.easySettings["planeSpeed"].toString()}
                    defaultValue={this.state.id.toString()}
                    maxLength={3} //setting limit of input
                  />

                  {/* TIMER EASY */}
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changeTimer_easy(text)}
                    value={this.state.easySettings["timer"].toString()}
                    defaultValue={this.state.id.toString()}
                    maxLength={3} //setting limit of input
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View style={styles.hardSign}>
                    <Text style={styles.settingsHead}>Schwierig</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changeNOPlanes_hard(text)}
                    value={this.state.hardSettings["numberOfPlanes"].toString()}
                    defaultValue={this.state.id.toString()}
                    maxLength={3} //setting limit of input
                  />
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changePlaneSpeed_hard(text)}
                    value={this.state.hardSettings["planeSpeed"].toString()}
                    defaultValue={this.state.id.toString()}
                    maxLength={3} //setting limit of input
                  />

                  {/* TIMER HARD */}
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    onChangeText={(text) => this.changeTimer_hard(text)}
                    value={this.state.hardSettings["timer"].toString()}
                    defaultValue={this.state.id.toString()}
                    maxLength={3} //setting limit of input
                  />
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={{
                ...styles.startButton,
                opacity: this.state.connected ? 1 : 0.5,
              }}
              disabled={this.state.connected ? false : true}
              onPress={this.start}
            >
              <Text
                style={{
                  ...styles.startButtonText,
                  opacity: this.state.connected ? 1 : 0.5,
                }}
              >
                Testlauf starten
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
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
            <View style={styles.infoField3}>
              <Text style={styles.statusTextLive}>
                Aktueller Abschnitt: {this.state.stateText}
              </Text>
              <Text style={styles.statusTextLive}>
                Verbleibende Zeit: {this.state.current_timer}
              </Text>
            </View>
            <Button
              onPress={() => {
                this.setDifficulty({
                  numberOfPlanes: 0,
                  planeSpeed: 0,
                  darkness: false,
                });

                this.setState({
                  live: false,
                  should_send_data: false,
                  awaitStart: false,
                  runTwo: false,
                });
                if (this.state.secondTimer) {
                  clearInterval(this.state.secondTimer);
                }
                if (this.state.thirdTimer) {
                  clearInterval(this.state.thirdTimer);
                }
              }}
              title={"Abbrechen"}
            ></Button>
            {this.state.awaitStart ? (
              <Button
                onPress={this.startFirst}
                title={"Erste Runde starten"}
              ></Button>
            ) : (
              <></>
            )}
            {this.state.runTwo ? (
              <Button
                onPress={this.startSecond}
                title={"Zweite Runde starten"}
              ></Button>
            ) : (
              <></>
            )}
          </View>
        )}
      </TouchableWithoutFeedback>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#838383",
  },
  infoFieldContainer: {
    margin: 20,
    width: 350,
    height: 250,
    backgroundColor: "#C4C4C4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: "center",
  },
  infoField1: {
    margin: 20,
    width: 350,
    height: 120,
    backgroundColor: "#C4C4C4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoField2: {
    top: 55,
    flexDirection: "row",
  },
  infoField3: {
    justifyContent: "center",
    margin: 20,
    width: 350,
    height: 250,
    backgroundColor: "#C4C4C4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: "#61B76A",
    elevation: 5,
    width: 140,
    height: 56,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  connectWatch: {
    position: "absolute",
    right: 15,
    backgroundColor: "#61B76A",
    elevation: 5,
    width: 90,
    height: 30,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectWatch: {
    position: "absolute",
    right: 15,
    backgroundColor: "#E97A7A",
    elevation: 5,
    width: 90,
    height: 30,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  changeID: {
    position: "absolute",
    right: 15,
    backgroundColor: "#FBC676",
    elevation: 5,
    width: 90,
    height: 30,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  startButtonText: {
    color: "white",
    fontFamily: "Roboto",
  },
  statusTextLive: {
    color: "white",
    fontFamily: "Roboto",
    fontSize: 20,
    fontWeight: "bold",
    left: 25,
    marginTop: 10,
    marginBottom: 10,
  },
  statusText: {
    color: "white",
    fontFamily: "Roboto",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 20,
  },
  settingsLineText: {
    color: "white",
    fontFamily: "Roboto",
    fontSize: 22,
    fontWeight: "bold",
    bottom: 50,
    right: 30,
  },
  statusLine: {
    flex: 1,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  settingsLine: {
    top: 70,
    marginTop: 15,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    backgroundColor: "#818181",
    height: 30,
    paddingVertical: 0,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    margin: 5,
  },
  easySign: {
    // backgroundColor: "#4E999E",C4C4C4
    height: 30,
    width: 75,
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
  },
  hardSign: {
    // backgroundColor: "#B5538D",
    height: 30,
    width: 75,
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
  },
  settingsHead: {
    color: "white",
    fontFamily: "Roboto",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default Settings;
