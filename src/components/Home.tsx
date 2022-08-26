import { FC } from "react";

import Wallet from "./Wallet";
import Converter from "./Converter";

const Home: FC = ({ }) => {
  return (
    <div>
      <div>
        <Wallet />
        <Converter />
      </div>
    </div>
  );
};

export default Home;