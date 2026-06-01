# IPv4 Network Visualization Lab - Net Lab

Net Lab 브라우저에서 네트워크 토폴로지를 만들어 패킷의 이동 과정을 관찰할 수 있는 네트워크 시뮬레이터 입니다.

[Demo](https://nlab.limeskin.kr/)

![IPv4 Network Visualization Lab 프로젝트 화면](docs/images/project-page.png)

`Host`, `Switch`, `Router`를 캔버스에 자유롭게 배치하고 연결해 네트워크를 구성하면 자동으로 IP 주소와 `Routing Table`을 구성합니다. 사용자는 네트워크가 실제로 어떤 순서로 동작하는지 각 정보의 상태는 어떤지 화면에서 실시간으로 관찰할 수 있습니다.

## 주요 기능

- 캔버스에서 `Host`, `Switch`, `Router`로 네트워크 토폴로지 구성
- IP 주소/대역, `Routing Table` 자동 구성
- `ICMP Echo Request`와 `ICMP Echo Reply` 흐름 시뮬레이션
- `Generic IPv4 Packet` 전송과 RAW payload 확인
- ARP 요청/응답, `ARP Cache`, 스위치 `MAC Address Table` 변화 추적
- `Routing Table`, `Longest Prefix Match`, `TTL` 감소 과정 확인
- 패킷 이동 애니메이션과 `Event Log`로 처리 단계 확인
- URL 공유

## 실행하기

```bash
npm install
npm run dev
```

브라우저에서 출력된 로컬 주소를 열면 바로 사용할 수 있습니다.

Docker로 실행하려면 다음 명령을 사용할 수 있습니다.

```bash
docker build -t network-lab .
docker run --rm -p 8080:80 network-lab
```

그다음 `http://localhost:8080`을 열면 됩니다.
