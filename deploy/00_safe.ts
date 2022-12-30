import { deployments} from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

 const func: DeployFunction = async ({ getNamedAccounts }: HardhatRuntimeEnvironment) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    console.log('deployer:', deployer);
    await deploy('DigitalSafe', {
        contract: 'DigitalSafe',
        from: deployer,
        args: [],
        log: true
    });
}
export default func;