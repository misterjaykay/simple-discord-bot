module.exports = {
  // name of command
  name: "기간",
  cooldown: 5,
  guildOnly: true,
  description: "마니또 기간 체크확인",
  execute(message, args) {
    let startStamp = 1638381600;
    var startDate = new Date(startStamp * 1000);

    var todayDate = new Date();

    const todayMonth = todayDate.getMonth();
    const todayDay = todayDate.getDate();

    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();

    const fullToday = `${todayMonth + 1}월 ${todayDay}일`;
    const fullStart = `${startMonth + 1}월 ${startDay}일`;

    // console.log(fullToday);
    // console.log(fullStart);

    if (fullToday != fullStart) {
        message.channel.send(`오늘은 시작하는 날이 아닙니다. \n시작하는 날은 ${fullStart} 입니다.`);
    } else {
        message.channel.send("이미 시작되었습니다. !내마니또 로 자기 상대를 확인하시면 됩니다.");
    }

  },
};
